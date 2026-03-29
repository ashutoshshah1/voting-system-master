import express from "express";
import cors from "cors";
import multer from "multer";
import { z } from "zod";
import { createHash } from "crypto";
import { isAddress } from "ethers";
import { prisma } from "./lib/prisma.js";
import { env } from "./lib/env.js";
import { ensureBucket, getObject, uploadCandidateImage, uploadKycDocument } from "./lib/s3.js";
import { requireAdmin, requireAuth, signToken } from "./lib/auth.js";
import { applySecurityHeaders, createRateLimiter, mapWithConcurrency } from "./lib/security.js";
import {
  addCandidateOnChain,
  createWallet,
  fundWallet,
  getElectionActiveOnChain,
  getResultsPublishedOnChain,
  getWalletBalanceOnChain,
  getVoterStatusOnChain,
  publishResultsOnChain,
  resetElectionOnChain,
  registerVoterOnChain,
  setElectionActiveOnChain,
  setEligibilityOnChain,
  submitVote,
} from "./lib/blockchain.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.disable("x-powered-by");

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(applySecurityHeaders);
app.use(express.json({ limit: "200kb" }));

const NID_PATTERN = /^\d{10}$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const parseDateOnly = (value: string) => {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return null;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
};

const isValidDob = (value: string) => {
  const parsed = parseDateOnly(value);
  if (!parsed) {
    return false;
  }
  const today = new Date();
  const maxDob = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const minDob = Date.UTC(1900, 0, 1);
  const dobTime = parsed.getTime();
  return dobTime >= minDob && dobTime <= maxDob;
};

const nidSchema = z
  .string()
  .trim()
  .regex(NID_PATTERN, "NID must be exactly 10 digits");
const dobSchema = z
  .string()
  .trim()
  .regex(DATE_ONLY_PATTERN, "Date of birth must use YYYY-MM-DD format")
  .refine(isValidDob, "Date of birth must be a real past date");

const getValidationMessage = (error: z.ZodError, fallback = "Invalid payload") =>
  error.issues[0]?.message ?? fallback;

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  nid: nidSchema,
  dob: dobSchema,
});

const loginSchema = z.object({
  nid: nidSchema,
  dob: dobSchema,
});

const reviewSchema = z.object({
  reviewNote: z.string().max(500).optional(),
});

const voteSchema = z.object({
  candidateId: z.coerce.number().int().positive(),
});

const candidateSchema = z.object({
  name: z.string().min(1),
  party: z.string().min(1),
});

const electionStatusSchema = z.object({
  active: z.boolean(),
});

const eligibilitySchema = z.object({
  walletAddress: z.string().min(6),
  eligible: z.boolean(),
});

const adminVotersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const ZERO_VOTER_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const ADMIN_VOTER_LOOKUP_CONCURRENCY = 6;

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeNid = (nid: string) => nid.trim();
const normalizeDob = (dob: string) => dob.trim();
const normalizeWalletAddress = (walletAddress: string) =>
  walletAddress.trim().toLowerCase();

const extractNidForRateLimit = (value: unknown) =>
  typeof value === "string" ? normalizeNid(value) : "";

const authRegisterLimiter = createRateLimiter({
  keyPrefix: "auth-register",
  windowMs: 60_000,
  max: 15,
  message: "Too many registration attempts. Please wait and try again.",
  keyFn: (req) => `${req.ip}:${extractNidForRateLimit(req.body?.nid)}`,
});

const authLoginLimiter = createRateLimiter({
  keyPrefix: "auth-login",
  windowMs: 60_000,
  max: 30,
  message: "Too many login attempts. Please wait and try again.",
  keyFn: (req) => `${req.ip}:${extractNidForRateLimit(req.body?.nid)}`,
});

const voteLimiter = createRateLimiter({
  keyPrefix: "vote-submit",
  windowMs: 60_000,
  max: 20,
  message: "Too many vote attempts. Please retry shortly.",
});

const kycSubmitLimiter = createRateLimiter({
  keyPrefix: "kyc-submit",
  windowMs: 60_000,
  max: 20,
  message: "Too many KYC submissions. Please retry shortly.",
});

const adminMutationLimiter = createRateLimiter({
  keyPrefix: "admin-mutation",
  windowMs: 60_000,
  max: 40,
  message: "Too many admin actions. Please retry shortly.",
});

const getErrorReason = (error: any) =>
  `${error?.reason ?? ""} ${error?.shortMessage ?? ""} ${error?.message ?? ""}`.toLowerCase();

const isAlreadyRegisteredError = (error: any) => {
  const reason = getErrorReason(error);
  return (
    reason.includes("wallet already registered") ||
    reason.includes("voter id already registered")
  );
};

const extractKycKey = (documentUrl: string) => {
  try {
    const parsed = new URL(documentUrl);
    const prefix = `/${env.minioBucket}/`;
    if (!parsed.pathname.startsWith(prefix)) {
      return null;
    }
    return decodeURIComponent(parsed.pathname.slice(prefix.length));
  } catch {
    return null;
  }
};

const resolveObjectBody = async (body: unknown) => {
  if (!body) {
    return Buffer.alloc(0);
  }
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (typeof body === "string") {
    return Buffer.from(body);
  }
  if (typeof (body as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === "function") {
    const buffer = await (body as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
    return Buffer.from(buffer);
  }
  if (
    typeof (body as { transformToByteArray?: () => Promise<Uint8Array> })
      .transformToByteArray === "function"
  ) {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> })
      .transformToByteArray();
    return Buffer.from(bytes);
  }
  return Buffer.alloc(0);
};

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/wallet/balance", requireAuth, async (req, res) => {
  const userId = req.user?.sub;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  if (!user.walletAddress) {
    return res.json({ walletAddress: null, balance: null });
  }
  try {
    const balance = await getWalletBalanceOnChain(user.walletAddress);
    return res.json({ walletAddress: user.walletAddress, balance });
  } catch (error: any) {
    const reason =
      error?.reason || error?.shortMessage || error?.message || "Failed to fetch balance";
    return res.status(500).json({ message: reason });
  }
});

app.post("/auth/register", authRegisterLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: getValidationMessage(parsed.error) });
  }
  const fullName = parsed.data.fullName.trim();
  const email = normalizeEmail(parsed.data.email);
  const nid = normalizeNid(parsed.data.nid);
  const dob = normalizeDob(parsed.data.dob);
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { nid }],
    },
  });
  if (existing) {
    return res.status(409).json({ message: "Email or NID already registered" });
  }
  const user = await prisma.user.create({
    data: { email, fullName, nid, dob },
  });
  const token = signToken({ sub: user.id, role: user.role });
  return res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      kycStatus: user.kycStatus,
      walletAddress: user.walletAddress,
    },
  });
});

app.post("/auth/login", authLoginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: getValidationMessage(parsed.error) });
  }
  const nid = normalizeNid(parsed.data.nid);
  const dob = normalizeDob(parsed.data.dob);
  const user = await prisma.user.findUnique({ where: { nid } });
  if (!user) {
    return res
      .status(401)
      .json({ message: "NID or date of birth is incorrect." });
  }
  if (user.dob !== dob) {
    return res
      .status(401)
      .json({ message: "NID or date of birth is incorrect." });
  }
  const token = signToken({ sub: user.id, role: user.role });
  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      kycStatus: user.kycStatus,
      walletAddress: user.walletAddress,
    },
  });
});

app.get("/me", requireAuth, async (req, res) => {
  const userId = req.user?.sub;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  return res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    kycStatus: user.kycStatus,
    walletAddress: user.walletAddress,
    voterIdHash: user.voterIdHash,
  });
});

app.post(
  "/kyc/submit",
  kycSubmitLimiter,
  requireAuth,
  upload.single("document"),
  async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Document file is required" });
  }
  const documentType =
    typeof req.body?.documentType === "string" ? req.body.documentType : null;
  if (!documentType) {
    return res.status(400).json({ message: "documentType is required" });
  }
  const userId = req.user?.sub;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const key = `kyc/${userId}/${Date.now()}-${req.file.originalname}`;
  const documentUrl = await uploadKycDocument(key, req.file.buffer, req.file.mimetype);

  const submission = await prisma.kycSubmission.upsert({
    where: { userId },
    update: { documentType, documentUrl, status: "PENDING", reviewNote: null },
    create: { userId, documentType, documentUrl },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { kycStatus: "PENDING" },
  });

  return res.status(201).json({
    id: submission.id,
    status: submission.status,
    documentUrl: submission.documentUrl,
  });
  }
);

app.get("/admin/kyc/pending", requireAuth, requireAdmin, async (_req, res) => {
  const submissions = await prisma.kycSubmission.findMany({
    where: { status: "PENDING" },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
  return res.json(
    submissions.map((submission: (typeof submissions)[number]) => ({
      id: submission.id,
      documentType: submission.documentType,
      documentUrl: submission.documentUrl,
      status: submission.status,
      createdAt: submission.createdAt,
      user: {
        id: submission.user.id,
        fullName: submission.user.fullName,
        email: submission.user.email,
        walletAddress: submission.user.walletAddress,
      },
    }))
  );
});

app.get("/admin/kyc/:id/document", requireAuth, requireAdmin, async (req, res) => {
  const submissionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!submissionId) {
    return res.status(400).json({ message: "Invalid submission id" });
  }
  const submission = await prisma.kycSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) {
    return res.status(404).json({ message: "Document not found" });
  }
  const key = extractKycKey(submission.documentUrl);
  if (!key) {
    return res.status(400).json({ message: "Invalid document reference" });
  }
  try {
    const object = await getObject(key);
    const contentType = object.ContentType || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");
    if (object.Body && typeof (object.Body as { pipe?: unknown }).pipe === "function") {
      (object.Body as NodeJS.ReadableStream).pipe(res);
      return;
    }
    const buffer = await resolveObjectBody(object.Body);
    return res.end(buffer);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch document" });
  }
});

app.get("/admin/voters", requireAuth, requireAdmin, async (_req, res) => {
  const query = adminVotersQuerySchema.safeParse(_req.query);
  if (!query.success) {
    return res.status(400).json({ message: "Invalid query parameters" });
  }
  const limit = query.data.limit ?? 250;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const voters = await mapWithConcurrency(
    users,
    ADMIN_VOTER_LOOKUP_CONCURRENCY,
    async (user: (typeof users)[number]) => {
      let onChain:
        | { eligible: boolean; hasVoted: boolean; voterIdHash: string }
        | null = null;
      let onChainError: string | null = null;
      if (user.walletAddress) {
        try {
          onChain = await getVoterStatusOnChain(user.walletAddress);
        } catch (error) {
          onChainError = error instanceof Error ? error.message : "On-chain lookup failed";
        }
      }
      return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        kycStatus: user.kycStatus,
        walletAddress: user.walletAddress,
        voterIdHash: user.voterIdHash,
        createdAt: user.createdAt,
        onChain,
        onChainError,
      };
    }
  );

  return res.json({ voters, limit, count: voters.length });
});

app.get("/candidates", async (req, res) => {
  const assets = await prisma.candidateAsset.findMany({
    orderBy: { candidateId: "asc" },
  });
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  return res.json({
    items: assets.map((asset: (typeof assets)[number]) => ({
      candidateId: asset.candidateId,
      imageUrl: asset.imageKey ? `${baseUrl}/candidates/${asset.candidateId}/image` : null,
    })),
  });
});

app.get("/candidates/:id/image", async (req, res) => {
  const candidateId = Number(req.params.id);
  if (!Number.isInteger(candidateId)) {
    return res.status(400).json({ message: "Invalid candidate id" });
  }
  const asset = await prisma.candidateAsset.findUnique({ where: { candidateId } });
  if (!asset?.imageKey) {
    return res.status(404).json({ message: "Image not found" });
  }
  try {
    const object = await getObject(asset.imageKey);
    const contentType = object.ContentType || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", "inline");
    if (object.Body && typeof (object.Body as { pipe?: unknown }).pipe === "function") {
      (object.Body as NodeJS.ReadableStream).pipe(res);
      return;
    }
    const buffer = await resolveObjectBody(object.Body);
    return res.end(buffer);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch image" });
  }
});

app.post(
  "/admin/kyc/:id/approve",
  adminMutationLimiter,
  requireAuth,
  requireAdmin,
  async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload" });
  }
  const submissionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!submissionId) {
    return res.status(400).json({ message: "Invalid submission id" });
  }
  const submission = await prisma.kycSubmission.findUnique({
    where: { id: submissionId },
    include: { user: true },
  });
  if (!submission) {
    return res.status(404).json({ message: "Submission not found" });
  }
  const voterIdHash = `0x${createHash("sha256").update(submission.userId).digest("hex")}`;
  const updated = await prisma.kycSubmission.update({
    where: { id: submission.id },
    data: {
      status: "APPROVED",
      reviewNote: parsed.data.reviewNote || null,
      reviewedBy: req.user?.sub,
    },
  });
  await prisma.user.update({
    where: { id: submission.userId },
    data: { kycStatus: "APPROVED", voterIdHash },
  });
  let walletAddress = submission.user.walletAddress
    ? normalizeWalletAddress(submission.user.walletAddress)
    : null;
  if (walletAddress && walletAddress !== submission.user.walletAddress) {
    await prisma.user.update({
      where: { id: submission.userId },
      data: { walletAddress },
    });
  }
  if (!walletAddress) {
    const wallet = createWallet();
    walletAddress = wallet.address;
    await prisma.user.update({
      where: { id: submission.userId },
      data: {
        walletAddress,
        walletEncryptedKey: wallet.encryptedKey,
      },
    });
    try {
      await fundWallet(walletAddress);
    } catch (error) {
      return res.status(500).json({ message: "Wallet funding failed" });
    }
  }
  try {
    await registerVoterOnChain(walletAddress, voterIdHash);
  } catch (error: any) {
    const reason = error?.reason || error?.shortMessage || error?.message || "";
    const normalized = reason.toLowerCase();
    if (
      normalized.includes("wallet already registered") ||
      normalized.includes("voter id already registered")
    ) {
      return res.json({
        id: updated.id,
        status: updated.status,
        voterIdHash,
        walletAddress,
      });
    }
    console.error("On-chain registration failed:", error);
    return res.status(500).json({
      message: "On-chain registration failed",
      details: reason || "Unknown error",
    });
  }
  return res.json({
    id: updated.id,
    status: updated.status,
    voterIdHash,
    walletAddress,
  });
  }
);

app.post(
  "/admin/kyc/:id/reject",
  adminMutationLimiter,
  requireAuth,
  requireAdmin,
  async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload" });
  }
  const submissionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!submissionId) {
    return res.status(400).json({ message: "Invalid submission id" });
  }
  const submission = await prisma.kycSubmission.findUnique({ where: { id: submissionId } });
  if (!submission) {
    return res.status(404).json({ message: "Submission not found" });
  }
  const updated = await prisma.kycSubmission.update({
    where: { id: submission.id },
    data: {
      status: "REJECTED",
      reviewNote: parsed.data.reviewNote || null,
      reviewedBy: req.user?.sub,
    },
  });
  await prisma.user.update({
    where: { id: submission.userId },
    data: { kycStatus: "REJECTED" },
  });
    return res.json({ id: updated.id, status: updated.status });
  }
);

app.post(
  "/admin/candidates",
  adminMutationLimiter,
  requireAuth,
  requireAdmin,
  upload.single("image"),
  async (req, res) => {
  const parsed = candidateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload" });
  }
  try {
    const { txHash, candidateId } = await addCandidateOnChain(
      parsed.data.name,
      parsed.data.party
    );
    if (candidateId !== null) {
      let imageKey: string | null = null;
      if (req.file) {
        const key = `candidates/${candidateId}/${Date.now()}-${req.file.originalname}`;
        imageKey = await uploadCandidateImage(key, req.file.buffer, req.file.mimetype);
      }
      await prisma.candidateAsset.upsert({
        where: { candidateId },
        update: {
          name: parsed.data.name,
          party: parsed.data.party,
          imageKey,
        },
        create: {
          candidateId,
          name: parsed.data.name,
          party: parsed.data.party,
          imageKey,
        },
      });
    }
    return res.status(201).json({ txHash, candidateId });
  } catch (error: any) {
    const reason =
      error?.reason || error?.shortMessage || error?.message || "Failed to add candidate";
    console.error("Failed to add candidate:", error);
    return res.status(500).json({ message: reason });
  }
  }
);

app.post(
  "/admin/election/status",
  adminMutationLimiter,
  requireAuth,
  requireAdmin,
  async (req, res) => {
  const parsed = electionStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload" });
  }
  if (parsed.data.active) {
    try {
      const published = await getResultsPublishedOnChain();
      if (published) {
        return res.status(409).json({
          message: "Results already published. Reset the election to start again.",
        });
      }
    } catch (error) {
      return res.status(500).json({ message: "Failed to verify election status" });
    }
  }
  try {
    const txHash = await setElectionActiveOnChain(parsed.data.active);
    return res.json({ txHash, active: parsed.data.active });
  } catch (error: any) {
    const reason =
      error?.reason ||
      error?.shortMessage ||
      error?.message ||
      "Failed to update election status";
    console.error("Failed to update election status:", error);
    return res.status(500).json({ message: reason });
  }
  }
);

app.post(
  "/admin/results/publish",
  adminMutationLimiter,
  requireAuth,
  requireAdmin,
  async (_req, res) => {
  try {
    const active = await getElectionActiveOnChain();
    if (active) {
      return res
        .status(409)
        .json({ message: "Election must be closed before publishing results." });
    }
  } catch (error) {
    return res.status(500).json({ message: "Failed to verify election status" });
  }
  try {
    const txHash = await publishResultsOnChain();
    return res.json({ txHash });
  } catch (error) {
    return res.status(500).json({ message: "Failed to publish results" });
  }
  }
);

app.post(
  "/admin/election/reset",
  adminMutationLimiter,
  requireAuth,
  requireAdmin,
  async (_req, res) => {
  try {
    const txHash = await resetElectionOnChain();
    await prisma.candidateAsset.deleteMany();
    return res.json({ txHash });
  } catch (error) {
    return res.status(500).json({ message: "Failed to reset election" });
  }
  }
);

app.post(
  "/admin/voters/eligibility",
  adminMutationLimiter,
  requireAuth,
  requireAdmin,
  async (req, res) => {
  const parsed = eligibilitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload" });
  }
  try {
    const walletAddress = normalizeWalletAddress(parsed.data.walletAddress);
    if (!isAddress(walletAddress)) {
      return res.status(400).json({ message: "Invalid wallet address" });
    }
    const status = await getVoterStatusOnChain(walletAddress);
    const isRegistered =
      status.voterIdHash && status.voterIdHash !== ZERO_VOTER_HASH;
    if (!isRegistered) {
      const user = await prisma.user.findFirst({
        where: {
          walletAddress: { equals: walletAddress, mode: "insensitive" },
        },
        select: { voterIdHash: true },
      });
      if (!user?.voterIdHash) {
        return res.status(409).json({
          message: "Voter not registered for the current election.",
        });
      }
      const registerTxHash = await registerVoterOnChain(
        walletAddress,
        user.voterIdHash
      );
      if (!parsed.data.eligible) {
        const txHash = await setEligibilityOnChain(
          walletAddress,
          parsed.data.eligible
        );
        return res.json({ txHash, registerTxHash });
      }
      return res.json({ txHash: registerTxHash, registerTxHash });
    }

    const txHash = await setEligibilityOnChain(walletAddress, parsed.data.eligible);
    return res.json({ txHash });
  } catch (error: any) {
    const reason =
      error?.reason || error?.shortMessage || error?.message || "Failed to update eligibility";
    return res.status(500).json({ message: reason });
  }
  }
);

app.post("/vote", voteLimiter, requireAuth, async (req, res) => {
  const parsed = voteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload" });
  }
  const userId = req.user?.sub;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  if (user.kycStatus !== "APPROVED") {
    return res.status(403).json({
      message: "KYC approval is still pending. Ask an admin to approve this voter before voting.",
    });
  }
  if (!user.walletAddress) {
    return res.status(409).json({
      message: "Voting wallet is not ready yet. Please complete wallet setup or contact an admin.",
    });
  }
  const walletAddress = normalizeWalletAddress(user.walletAddress);
  if (!user.walletEncryptedKey) {
    return res.status(409).json({
      message: "Voting wallet is not ready yet. Please complete wallet setup or contact an admin.",
    });
  }
  try {
    const [active, published] = await Promise.all([
      getElectionActiveOnChain(),
      getResultsPublishedOnChain(),
    ]);
    if (!active) {
      return res.status(409).json({ message: "Election is closed" });
    }
    if (published) {
      return res.status(409).json({ message: "Results already published" });
    }
  } catch (error) {
    return res.status(500).json({ message: "Failed to verify election status" });
  }

  let voterStatus:
    | { eligible: boolean; hasVoted: boolean; voterIdHash: string }
    | null = null;
  try {
    voterStatus = await getVoterStatusOnChain(walletAddress);
  } catch (error: any) {
    const reason =
      error?.reason ||
      error?.shortMessage ||
      error?.message ||
      "Failed to verify voter status";
    return res.status(500).json({ message: reason });
  }

  const isRegistered =
    Boolean(voterStatus.voterIdHash) && voterStatus.voterIdHash !== ZERO_VOTER_HASH;
  if (!isRegistered) {
    if (!user.voterIdHash) {
      return res.status(409).json({ message: "Voter is not registered on-chain yet" });
    }
    try {
      await registerVoterOnChain(walletAddress, user.voterIdHash);
    } catch (error: any) {
      if (!isAlreadyRegisteredError(error)) {
        const reason =
          error?.reason ||
          error?.shortMessage ||
          error?.message ||
          "On-chain voter registration failed";
        return res.status(500).json({ message: reason });
      }
    }
    try {
      voterStatus = await getVoterStatusOnChain(walletAddress);
    } catch (error: any) {
      const reason =
        error?.reason ||
        error?.shortMessage ||
        error?.message ||
        "Failed to verify voter status";
      return res.status(500).json({ message: reason });
    }
  }

  if (!voterStatus.eligible) {
    return res.status(403).json({ message: "Voter is not eligible for this election" });
  }
  if (voterStatus.hasVoted) {
    return res.status(409).json({ message: "Vote already recorded for this wallet" });
  }

  const isInsufficientFunds = (error: any) => {
    if (!error) return false;
    if (error.code === "INSUFFICIENT_FUNDS") return true;
    const message = `${error.shortMessage ?? ""} ${error.reason ?? ""} ${
      error.message ?? ""
    }`.toLowerCase();
    return message.includes("insufficient funds") || message.includes("insufficient balance");
  };
  const getVoteErrorMessage = (error: any) =>
    error?.reason || error?.shortMessage || error?.message || "Vote transaction failed";
  try {
    const txHash = await submitVote(user.walletEncryptedKey, parsed.data.candidateId);
    return res.json({ txHash });
  } catch (error: any) {
    let voteError = error;
    if (isInsufficientFunds(error)) {
      try {
        await fundWallet(walletAddress);
        const txHash = await submitVote(user.walletEncryptedKey, parsed.data.candidateId);
        return res.json({ txHash });
      } catch (retryError: any) {
        voteError = retryError;
      }
    }
    console.error("Vote failed:", voteError);
    return res.status(500).json({
      message: getVoteErrorMessage(voteError),
      details: voteError?.reason || voteError?.message || "Unknown error",
    });
  }
});

const start = async () => {
  await ensureBucket();
  app.listen(env.port, () => {
    console.log(`API running on http://localhost:${env.port}`);
  });
};

start().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
