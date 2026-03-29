import express from "express";
import cors from "cors";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { KycStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import { applySecurityHeaders, createRateLimiter } from "./lib/security.js";
import {
  requireAdmin,
  requireAuth,
  signOfflineSession,
  verifyOfflinePrecheck,
  verifyOfflineSession,
} from "./lib/auth.js";
import {
  fundWallet,
  getElectionActiveOnChain,
  getResultsPublishedOnChain,
  getVoterStatusOnChain,
  registerVoterOnChain,
  setEligibilityOnChain,
  submitVote,
} from "./lib/blockchain.js";

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type ProfileWithUser = Prisma.OfflineProfileGetPayload<{
  include: { user: true };
}>;

const app = express();
const ZERO_VOTER_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
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
const pinSchema = z.string().trim().regex(/^\d{6,8}$/);

const getValidationMessage = (error: z.ZodError, fallback = "Invalid payload") =>
  error.issues[0]?.message ?? fallback;

const commonWeakPins = new Set([
  "000000",
  "0000000",
  "00000000",
  "111111",
  "1111111",
  "11111111",
  "112233",
  "121212",
  "123123",
  "123456",
  "1234567",
  "12345678",
  "654321",
  "87654321",
  "987654",
  "999999",
]);

const isWeakPin = (pin: string) => {
  if (/^(\d)\1+$/.test(pin)) {
    return true;
  }
  const asc = "0123456789";
  const desc = "9876543210";
  if (asc.includes(pin) || desc.includes(pin)) {
    return true;
  }
  return commonWeakPins.has(pin);
};

const strongPinSchema = pinSchema.refine((pin) => !isWeakPin(pin), {
  message: "Weak PIN is not allowed",
});

const normalizeNid = (nid: string) => nid.trim();
const normalizeDob = (dob: string) => dob.trim();
const normalizeOfficerEmployeeId = (employeeId: string) => employeeId.trim();

const rfidSessionLimiter = createRateLimiter({
  keyPrefix: "offline-session-start",
  windowMs: 60_000,
  max: 80,
  message: "Too many RFID session attempts. Please retry shortly.",
});

const profileLinkLimiter = createRateLimiter({
  keyPrefix: "offline-profile-link",
  windowMs: 60_000,
  max: 20,
  message: "Too many profile link attempts. Please retry shortly.",
  keyFn: (req) => `${req.ip}:${typeof req.body?.nid === "string" ? req.body.nid.trim() : ""}`,
});

const pinSetupLimiter = createRateLimiter({
  keyPrefix: "offline-pin-setup",
  windowMs: 60_000,
  max: 15,
  message: "Too many PIN setup attempts. Please retry shortly.",
  keyFn: (req) => `${req.ip}:${typeof req.body?.nid === "string" ? req.body.nid.trim() : ""}`,
});

const officerAttestationLimiter = createRateLimiter({
  keyPrefix: "offline-attest",
  windowMs: 60_000,
  max: 30,
  message: "Too many attestation attempts. Please retry shortly.",
  keyFn: (req) =>
    `${req.ip}:${typeof req.body?.officerEmployeeId === "string" ? req.body.officerEmployeeId.trim() : ""}`,
});

const offlineVoteLimiter = createRateLimiter({
  keyPrefix: "offline-vote",
  windowMs: 60_000,
  max: 25,
  message: "Too many vote attempts. Please retry shortly.",
});

const officerAdminLimiter = createRateLimiter({
  keyPrefix: "offline-admin-officer",
  windowMs: 60_000,
  max: 30,
  message: "Too many officer admin operations. Please retry shortly.",
});

const scanSchema = z.object({
  rfidUid: z.string().trim().min(4, "RFID card scan is required."),
});

const registerOfflineProfileSchema = scanSchema.extend({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email(),
  nid: nidSchema,
  dob: dobSchema,
  pin: strongPinSchema.optional(),
});

const linkOfflineProfileSchema = scanSchema.extend({
  nid: nidSchema,
  dob: dobSchema,
  pin: strongPinSchema.optional(),
});

const setupPinSchema = scanSchema.extend({
  nid: nidSchema,
  dob: dobSchema,
  pin: strongPinSchema,
});

const startSessionSchema = scanSchema;

const attestSessionSchema = z.object({
  preSessionToken: z.string().min(20, "Voting session expired. Scan the card again."),
  officerEmployeeId: z.string().trim().min(2),
  officerPin: strongPinSchema,
  boothCode: z.string().trim().min(2).max(64).optional(),
});

const voteSchema = z.object({
  sessionToken: z.string().min(20, "Voting session expired. Scan the card again."),
  pin: strongPinSchema,
  candidateId: z.coerce.number().int().positive(),
});

const upsertOfficerSchema = z.object({
  fullName: z.string().trim().min(2),
  employeeId: z.string().trim().min(2),
  pin: strongPinSchema,
  isActive: z.boolean().optional(),
});

const normalizeRfidUid = (rfidUid: string) => rfidUid.replace(/\s+/g, "").toUpperCase();

const hashRfidUid = (rfidUid: string) =>
  createHash("sha256")
    .update(`${env.offlineRfidPepper}:${normalizeRfidUid(rfidUid)}`)
    .digest("hex");

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

const createAuditEvent = async (params: {
  eventType: string;
  status: string;
  userId?: string | null;
  offlineProfileId?: string | null;
  reason?: string | null;
  metadata?: unknown;
  txHash?: string | null;
}) => {
  const data: Prisma.OfflineAuditEventUncheckedCreateInput = {
    eventType: params.eventType,
    status: params.status,
    userId: params.userId ?? null,
    offlineProfileId: params.offlineProfileId ?? null,
    reason: params.reason ?? null,
    txHash: params.txHash ?? null,
  };
  if (params.metadata !== undefined) {
    data.metadata = asJson(params.metadata);
  }
  await prisma.offlineAuditEvent.create({ data });
};

const safeAudit = async (params: Parameters<typeof createAuditEvent>[0]) => {
  try {
    await createAuditEvent(params);
  } catch (error) {
    console.error("Failed to write audit event", error);
  }
};

const findConflictingProfile = async (
  userId: string,
  rfidUidHash: string
) => {
  return prisma.offlineProfile.findFirst({
    where: {
      rfidUidHash,
      NOT: { userId },
    },
    select: { id: true, userId: true },
  });
};

const upsertOfflineProfile = async (params: {
  userId: string;
  rfidUid: string;
  pin?: string;
}) => {
  const rfidUidHash = hashRfidUid(params.rfidUid);
  const conflict = await findConflictingProfile(params.userId, rfidUidHash);
  if (conflict) {
    throw new ApiError(409, "RFID is already linked to another voter");
  }

  const existingProfile = await prisma.offlineProfile.findUnique({
    where: { userId: params.userId },
  });
  const pinHash = params.pin
    ? await bcrypt.hash(params.pin, env.offlinePinSaltRounds)
    : existingProfile?.pinHash ?? null;
  const pinSetupRequired = !pinHash;

  return prisma.offlineProfile.upsert({
    where: { userId: params.userId },
    update: {
      rfidUidHash,
      pinHash: pinHash ?? undefined,
      pinSetupRequired,
      failedPinAttempts: 0,
      blockedUntil: null,
      lastSeenAt: new Date(),
    },
    create: {
      userId: params.userId,
      rfidUidHash,
      pinHash,
      pinSetupRequired,
      failedPinAttempts: 0,
      lastSeenAt: new Date(),
    },
  });
};

const ensurePendingAdminReview = async (userId: string, rfidUid: string) => {
  const submissionUrl = `offline://booth/${hashRfidUid(rfidUid).slice(0, 12)}`;
  const status: KycStatus = "PENDING";
  await prisma.kycSubmission.upsert({
    where: { userId },
    update: {
      documentType: "OFFLINE_DEVICE_PROFILE",
      documentUrl: submissionUrl,
      status,
      reviewNote: null,
    },
    create: {
      userId,
      documentType: "OFFLINE_DEVICE_PROFILE",
      documentUrl: submissionUrl,
      status,
    },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { kycStatus: status },
  });
};

const buildSessionGate = (profile: ProfileWithUser) => {
  const pinReady = Boolean(profile.pinHash) && !profile.pinSetupRequired;
  const kycApproved = profile.user.kycStatus === "APPROVED";
  const walletReady = Boolean(profile.user.walletAddress) && Boolean(profile.user.walletEncryptedKey);
  return { pinReady, kycApproved, walletReady, officerVerificationRequired: false };
};

const isReadyForVoting = (gate: ReturnType<typeof buildSessionGate>) =>
  gate.pinReady && gate.kycApproved && gate.walletReady;

const joinNaturalList = (items: string[]) => {
  if (items.length === 0) {
    return "";
  }
  if (items.length === 1) {
    return items[0];
  }
  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
};

const getGateIssues = (gate: ReturnType<typeof buildSessionGate>) => {
  const issues: string[] = [];
  if (!gate.pinReady) {
    issues.push("set a 6-digit voter PIN");
  }
  if (!gate.kycApproved) {
    issues.push("complete admin KYC approval");
  }
  if (!gate.walletReady) {
    issues.push("wait for wallet setup to finish");
  }
  if (gate.officerVerificationRequired) {
    issues.push("complete officer verification");
  }
  return issues;
};

const buildGateBlockedMessage = (gate: ReturnType<typeof buildSessionGate>) => {
  const issues = getGateIssues(gate);
  if (!issues.length) {
    return "Identity verified. Ready for PIN confirmation.";
  }
  return `This card was recognized, but the voter cannot continue yet. Please ${joinNaturalList(
    issues
  )} before voting.`;
};

const getErrorReason = (error: any) =>
  `${error?.reason ?? ""} ${error?.shortMessage ?? ""} ${error?.message ?? ""}`.toLowerCase();

const isAlreadyRegisteredError = (error: any) => {
  const reason = getErrorReason(error);
  return (
    reason.includes("wallet already registered") ||
    reason.includes("voter id already registered")
  );
};

const isAlreadyEligibleError = (error: any) => {
  const reason = getErrorReason(error);
  return (
    reason.includes("already eligible") ||
    reason.includes("already set to this value") ||
    reason.includes("no state change")
  );
};

const ensureOfflineVoterOnChain = async (profile: ProfileWithUser) => {
  const walletAddress = profile.user.walletAddress;
  if (!walletAddress) {
    throw new ApiError(
      409,
      "Voting wallet is not ready yet. Ask an admin to finish voter setup."
    );
  }

  let voterIdHash = profile.user.voterIdHash;
  if (!voterIdHash) {
    voterIdHash = `0x${createHash("sha256").update(profile.user.id).digest("hex")}`;
    await prisma.user.update({
      where: { id: profile.user.id },
      data: { voterIdHash },
    });
  }

  let status = await getVoterStatusOnChain(walletAddress);
  const isRegistered = status.voterIdHash && status.voterIdHash !== ZERO_VOTER_HASH;
  let registerTxHash: string | null = null;
  let setEligibilityTxHash: string | null = null;

  if (!isRegistered) {
    try {
      registerTxHash = await registerVoterOnChain(walletAddress, voterIdHash);
    } catch (error: any) {
      if (!isAlreadyRegisteredError(error)) {
        throw error;
      }
    }
    status = await getVoterStatusOnChain(walletAddress);
  }

  if (!status.eligible) {
    try {
      setEligibilityTxHash = await setEligibilityOnChain(walletAddress, true);
    } catch (error: any) {
      if (!isAlreadyEligibleError(error)) {
        throw error;
      }
    }
  }

  status = await getVoterStatusOnChain(walletAddress);
  return { registerTxHash, setEligibilityTxHash, status };
};

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

const handleError = (res: express.Response, error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    return res.status(error.status).json({ message: error.message });
  }
  if (error instanceof Error) {
    return res.status(500).json({ message: error.message || fallback });
  }
  return res.status(500).json({ message: fallback });
};

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "offline-api-v2" });
});

app.post("/offline/profiles/register", profileLinkLimiter, async (req, res) => {
  const parsed = registerOfflineProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: getValidationMessage(parsed.error) });
  }

  const fullName = parsed.data.fullName.trim();
  const email = parsed.data.email.trim().toLowerCase();
  const nid = normalizeNid(parsed.data.nid);
  const dob = normalizeDob(parsed.data.dob);

  try {
    const userByNid = await prisma.user.findUnique({ where: { nid } });
    const userByEmail = await prisma.user.findUnique({ where: { email } });

    if (userByNid && userByEmail && userByNid.id !== userByEmail.id) {
      return res
        .status(409)
        .json({ message: "NID and email are linked to different existing users" });
    }

    let user = userByNid ?? userByEmail;
    if (!user) {
      user = await prisma.user.create({
        data: { fullName, email, nid, dob },
      });
    } else {
      if (user.nid !== nid) {
        return res.status(409).json({ message: "NID does not match the existing email account" });
      }
      if (user.email.toLowerCase() !== email) {
        return res.status(409).json({ message: "Email does not match the existing NID account" });
      }
      if (user.dob !== dob) {
        return res
          .status(409)
          .json({ message: "DOB does not match the existing account for this NID" });
      }
      user = await prisma.user.update({
        where: { id: user.id },
        data: { fullName },
      });
    }

    const profile = await upsertOfflineProfile({
      userId: user.id,
      rfidUid: parsed.data.rfidUid,
      pin: parsed.data.pin,
    });

    if (user.kycStatus !== "APPROVED") {
      await ensurePendingAdminReview(user.id, parsed.data.rfidUid);
    }

    const refreshedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        nid: true,
        dob: true,
        kycStatus: true,
        role: true,
        walletAddress: true,
      },
    });

    await safeAudit({
      eventType: "PROFILE_REGISTER",
      status: "SUCCESS",
      userId: user.id,
      offlineProfileId: profile.id,
      metadata: {
        source: "OFFLINE_BOOTH",
        pinProvided: Boolean(parsed.data.pin),
      },
    });

    return res.status(201).json({
      message: "Offline profile linked",
      user: refreshedUser,
      offlineProfile: {
        id: profile.id,
        pinSetupRequired: profile.pinSetupRequired,
      },
      requiresAdminApproval: refreshedUser?.kycStatus !== "APPROVED",
    });
  } catch (error) {
    await safeAudit({
      eventType: "PROFILE_REGISTER",
      status: "FAILED",
      reason: error instanceof Error ? error.message : "Unknown error",
      metadata: {
        nid,
      },
    });
    return handleError(res, error, "Failed to register offline profile");
  }
});

app.post("/offline/profiles/link-online", profileLinkLimiter, async (req, res) => {
  const parsed = linkOfflineProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: getValidationMessage(parsed.error) });
  }

  const nid = normalizeNid(parsed.data.nid);
  const dob = normalizeDob(parsed.data.dob);

  try {
    const user = await prisma.user.findUnique({ where: { nid } });
    if (!user || user.dob !== dob) {
      return res.status(404).json({ message: "User not found for provided NID/DOB" });
    }

    const profile = await upsertOfflineProfile({
      userId: user.id,
      rfidUid: parsed.data.rfidUid,
      pin: parsed.data.pin,
    });

    await safeAudit({
      eventType: "PROFILE_LINK",
      status: "SUCCESS",
      userId: user.id,
      offlineProfileId: profile.id,
      metadata: {
        source: "ONLINE_TO_OFFLINE_LINK",
        pinProvided: Boolean(parsed.data.pin),
      },
    });

    return res.json({
      message: "Online account linked to offline profile",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        kycStatus: user.kycStatus,
        walletAddress: user.walletAddress,
      },
      offlineProfile: {
        id: profile.id,
        pinSetupRequired: profile.pinSetupRequired,
      },
      requiresAdminApproval: user.kycStatus !== "APPROVED",
    });
  } catch (error) {
    await safeAudit({
      eventType: "PROFILE_LINK",
      status: "FAILED",
      reason: error instanceof Error ? error.message : "Unknown error",
      metadata: { nid },
    });
    return handleError(res, error, "Failed to link online profile");
  }
});

app.post("/offline/pin/setup", pinSetupLimiter, async (req, res) => {
  const parsed = setupPinSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: getValidationMessage(parsed.error) });
  }

  const nid = normalizeNid(parsed.data.nid);
  const dob = normalizeDob(parsed.data.dob);

  try {
    const user = await prisma.user.findUnique({ where: { nid } });
    if (!user || user.dob !== dob) {
      return res.status(404).json({ message: "User not found for provided NID/DOB" });
    }
    const profile = await prisma.offlineProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      return res.status(404).json({ message: "Offline profile not found" });
    }

    const scannedRfidHash = hashRfidUid(parsed.data.rfidUid);
    if (profile.rfidUidHash !== scannedRfidHash) {
      return res.status(401).json({ message: "RFID card does not match this user" });
    }

    const pinHash = await bcrypt.hash(parsed.data.pin, env.offlinePinSaltRounds);
    await prisma.offlineProfile.update({
      where: { id: profile.id },
      data: {
        pinHash,
        pinSetupRequired: false,
        failedPinAttempts: 0,
        blockedUntil: null,
        lastSeenAt: new Date(),
      },
    });

    await safeAudit({
      eventType: "PIN_SETUP",
      status: "SUCCESS",
      userId: user.id,
      offlineProfileId: profile.id,
    });

    return res.json({ message: "Offline PIN is configured" });
  } catch (error) {
    await safeAudit({
      eventType: "PIN_SETUP",
      status: "FAILED",
      reason: error instanceof Error ? error.message : "Unknown error",
      metadata: { nid },
    });
    return handleError(res, error, "Failed to set PIN");
  }
});

app.post("/offline/session/start", rfidSessionLimiter, async (req, res) => {
  const parsed = startSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: getValidationMessage(parsed.error) });
  }

  const rfidUidHash = hashRfidUid(parsed.data.rfidUid);
  const profile = await prisma.offlineProfile.findUnique({
    where: {
      rfidUidHash,
    },
    include: { user: true },
  });

  if (!profile) {
    return res.status(401).json({
      message: "This card is not registered yet. Register or link it before voting.",
    });
  }

  if (profile.blockedUntil && profile.blockedUntil > new Date()) {
    await safeAudit({
      eventType: "SESSION_START",
      status: "FAILED",
      userId: profile.userId,
      offlineProfileId: profile.id,
      reason: "PIN entry temporarily locked",
    });
    return res.status(423).json({
      message: "PIN entry is temporarily locked",
      blockedUntil: profile.blockedUntil,
    });
  }

  await prisma.offlineProfile.update({
    where: { id: profile.id },
    data: { lastSeenAt: new Date() },
  });

  const gate = buildSessionGate(profile);
  const sessionToken = isReadyForVoting(gate)
    ? signOfflineSession({
        sub: profile.userId,
        offlineProfileId: profile.id,
      })
    : null;
  // Backward compatibility for legacy clients that still expect preSessionToken.
  const preSessionToken = sessionToken;

  await safeAudit({
    eventType: "SESSION_START",
    status: sessionToken ? "READY_FOR_VOTE" : "NEEDS_ACTION",
    userId: profile.userId,
    offlineProfileId: profile.id,
    metadata: gate,
  });

  return res.json({
    message: sessionToken
      ? "Identity verified. Ready for PIN confirmation."
      : buildGateBlockedMessage(gate),
    preSessionToken,
    sessionToken,
    gate,
    user: {
      id: profile.user.id,
      fullName: profile.user.fullName,
      nid: profile.user.nid,
      kycStatus: profile.user.kycStatus,
      walletAddress: profile.user.walletAddress,
    },
  });
});

app.post("/offline/session/attest", officerAttestationLimiter, async (req, res) => {
  const parsed = attestSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: getValidationMessage(parsed.error) });
  }
  // Officer attestation is disabled in simplified flow.
  // Keep this endpoint as a compatibility bridge for legacy clients.
  let profileId: string | null = null;
  let userId: string | null = null;
  let sessionToken: string | null = null;

  try {
    const payload = verifyOfflineSession(parsed.data.preSessionToken);
    if (payload.scope === "OFFLINE_VOTE") {
      profileId = payload.offlineProfileId;
      userId = payload.sub;
      sessionToken = parsed.data.preSessionToken;
    }
  } catch {
    // Ignore and try precheck token parsing below.
  }

  if (!profileId || !userId) {
    let precheckPayload: ReturnType<typeof verifyOfflinePrecheck>;
    try {
      precheckPayload = verifyOfflinePrecheck(parsed.data.preSessionToken);
    } catch {
      return res.status(401).json({ message: "Invalid or expired pre-session token" });
    }

    if (precheckPayload.scope !== "OFFLINE_PRECHECK") {
      return res.status(401).json({ message: "Invalid pre-session scope" });
    }
    profileId = precheckPayload.offlineProfileId;
    userId = precheckPayload.sub;
  }

  const profile = await prisma.offlineProfile.findUnique({
    where: { id: profileId },
    include: { user: true },
  });
  if (!profile || profile.userId !== userId) {
    return res.status(401).json({ message: "Invalid pre-session profile" });
  }

  if (profile.blockedUntil && profile.blockedUntil > new Date()) {
    return res.status(423).json({
      message: "PIN entry is temporarily locked",
      blockedUntil: profile.blockedUntil,
    });
  }

  const gate = buildSessionGate(profile);
  if (!isReadyForVoting(gate)) {
    return res.status(409).json({
      message: buildGateBlockedMessage(gate),
      gate,
    });
  }

  if (!sessionToken) {
    sessionToken = signOfflineSession({
      sub: profile.userId,
      offlineProfileId: profile.id,
    });
  }

  const expiresAt = new Date(Date.now() + env.offlineSessionMinutes * 60_000);
  await safeAudit({
    eventType: "SESSION_ATTESTATION",
    status: "BYPASSED",
    userId: profile.userId,
    offlineProfileId: profile.id,
    metadata: {
      officerStepDisabled: true,
      boothCode: parsed.data.boothCode ?? null,
      requestedOfficerEmployeeId: normalizeOfficerEmployeeId(parsed.data.officerEmployeeId),
      expiresAt,
    },
  });

  return res.json({
    message: "Officer attestation is disabled. Continue with PIN confirmation.",
    sessionToken,
    expiresAt,
  });
});

app.post("/offline/vote", offlineVoteLimiter, async (req, res) => {
  const parsed = voteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: getValidationMessage(parsed.error) });
  }

  let payload: ReturnType<typeof verifyOfflineSession>;
  try {
    payload = verifyOfflineSession(parsed.data.sessionToken);
  } catch {
    return res.status(401).json({ message: "Invalid or expired offline session" });
  }

  if (payload.scope !== "OFFLINE_VOTE") {
    return res.status(401).json({ message: "Invalid offline session scope" });
  }

  const profile = await prisma.offlineProfile.findUnique({
    where: { id: payload.offlineProfileId },
    include: { user: true },
  });
  if (!profile || profile.userId !== payload.sub) {
    return res.status(401).json({ message: "Invalid booth session profile" });
  }

  if (profile.blockedUntil && profile.blockedUntil > new Date()) {
    return res.status(423).json({
      message: "PIN entry is temporarily locked",
      blockedUntil: profile.blockedUntil,
    });
  }

  if (profile.pinSetupRequired || !profile.pinHash) {
    return res.status(409).json({
      message: "PIN setup is required before offline voting. Create a 6-digit PIN first.",
    });
  }

  const pinMatch = await bcrypt.compare(parsed.data.pin, profile.pinHash);
  if (!pinMatch) {
    const nextAttempts = profile.failedPinAttempts + 1;
    const shouldLock = nextAttempts >= env.offlinePinAttemptsLimit;
    const blockedUntil = shouldLock
      ? new Date(Date.now() + env.offlineLockMinutes * 60_000)
      : null;

    await prisma.offlineProfile.update({
      where: { id: profile.id },
      data: {
        failedPinAttempts: shouldLock ? 0 : nextAttempts,
        blockedUntil,
      },
    });

    await safeAudit({
      eventType: "VOTE_ATTEMPT",
      status: "FAILED",
      userId: profile.userId,
      offlineProfileId: profile.id,
      reason: shouldLock ? "PIN lockout triggered" : "Invalid PIN",
      metadata: { candidateId: parsed.data.candidateId },
    });

    return res.status(shouldLock ? 423 : 401).json({
      message: shouldLock
        ? `Too many incorrect PIN attempts. Booth is locked for ${env.offlineLockMinutes} minutes.`
        : "Invalid PIN",
      blockedUntil,
    });
  }

  await prisma.offlineProfile.update({
    where: { id: profile.id },
    data: {
      failedPinAttempts: 0,
      blockedUntil: null,
      lastSeenAt: new Date(),
    },
  });

  if (profile.user.kycStatus !== "APPROVED") {
    return res.status(403).json({
      message: "KYC approval is still pending. Ask an admin to approve this voter before voting.",
    });
  }
  if (!profile.user.walletAddress || !profile.user.walletEncryptedKey) {
    return res.status(409).json({
      message: "Voting wallet is not ready yet. Ask an admin to finish voter setup.",
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
      return res.status(409).json({ message: "Results are already published" });
    }
  } catch {
    return res.status(500).json({ message: "Failed to verify election status" });
  }

  let onChainSync:
    | {
        registerTxHash: string | null;
        setEligibilityTxHash: string | null;
        status: { eligible: boolean; hasVoted: boolean; voterIdHash: string };
      }
    | null = null;
  try {
    onChainSync = await ensureOfflineVoterOnChain(profile);
  } catch (error: any) {
    const reason = getVoteErrorMessage(error);
    await safeAudit({
      eventType: "VOTE_ATTEMPT",
      status: "FAILED",
      userId: profile.userId,
      offlineProfileId: profile.id,
      reason: `On-chain voter sync failed: ${reason}`,
      metadata: { candidateId: parsed.data.candidateId },
    });
    return res.status(500).json({
      message: "Failed to sync voter on-chain",
      details: reason,
    });
  }

  if (!onChainSync.status.eligible) {
    await safeAudit({
      eventType: "VOTE_ATTEMPT",
      status: "FAILED",
      userId: profile.userId,
      offlineProfileId: profile.id,
      reason: "Voter is not eligible on-chain",
      metadata: { candidateId: parsed.data.candidateId },
    });
    return res.status(403).json({ message: "Voter is not eligible on-chain" });
  }

  if (onChainSync.status.hasVoted) {
    await safeAudit({
      eventType: "VOTE_ATTEMPT",
      status: "FAILED",
      userId: profile.userId,
      offlineProfileId: profile.id,
      reason: "Vote already recorded for this wallet",
      metadata: { candidateId: parsed.data.candidateId },
    });
    return res.status(409).json({ message: "Vote already recorded for this wallet" });
  }

  try {
    const txHash = await submitVote(profile.user.walletEncryptedKey, parsed.data.candidateId);
    await safeAudit({
      eventType: "VOTE_ATTEMPT",
      status: "SUCCESS",
      userId: profile.userId,
      offlineProfileId: profile.id,
      txHash,
      metadata: {
        candidateId: parsed.data.candidateId,
        sessionFlow: "RFID_PIN",
        onChainSync,
      },
    });
    return res.json({ txHash });
  } catch (error: any) {
    let voteError = error;
    if (isInsufficientFunds(error)) {
      try {
        await fundWallet(profile.user.walletAddress);
        const txHash = await submitVote(profile.user.walletEncryptedKey, parsed.data.candidateId);
        await safeAudit({
          eventType: "VOTE_ATTEMPT",
          status: "SUCCESS",
          userId: profile.userId,
          offlineProfileId: profile.id,
          txHash,
          metadata: {
            candidateId: parsed.data.candidateId,
            fundedRetry: true,
            sessionFlow: "RFID_PIN",
            onChainSync,
          },
        });
        return res.json({ txHash });
      } catch (retryError: any) {
        voteError = retryError;
      }
    }

    await safeAudit({
      eventType: "VOTE_ATTEMPT",
      status: "FAILED",
      userId: profile.userId,
      offlineProfileId: profile.id,
      reason: getVoteErrorMessage(voteError),
      metadata: { candidateId: parsed.data.candidateId },
    });

    return res.status(500).json({
      message: getVoteErrorMessage(voteError),
      details: voteError?.reason || voteError?.message || "Unknown error",
    });
  }
});

app.post(
  "/offline/admin/officers",
  officerAdminLimiter,
  requireAuth,
  requireAdmin,
  async (req, res) => {
  const parsed = upsertOfficerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid payload" });
  }

  try {
    const pinHash = await bcrypt.hash(parsed.data.pin, env.offlinePinSaltRounds);
    const employeeId = normalizeOfficerEmployeeId(parsed.data.employeeId);
    const officer = await prisma.boothOfficer.upsert({
      where: { employeeId },
      update: {
        fullName: parsed.data.fullName.trim(),
        pinHash,
        isActive: parsed.data.isActive ?? true,
      },
      create: {
        fullName: parsed.data.fullName.trim(),
        employeeId,
        pinHash,
        isActive: parsed.data.isActive ?? true,
      },
    });

    await safeAudit({
      eventType: "OFFICER_UPSERT",
      status: "SUCCESS",
      metadata: {
        officerId: officer.id,
        employeeId: officer.employeeId,
        isActive: officer.isActive,
      },
    });

    return res.status(201).json({
      message: "Officer saved",
      officer: {
        id: officer.id,
        fullName: officer.fullName,
        employeeId: officer.employeeId,
        isActive: officer.isActive,
        lastSeenAt: officer.lastSeenAt,
        createdAt: officer.createdAt,
        updatedAt: officer.updatedAt,
      },
    });
  } catch (error) {
    await safeAudit({
      eventType: "OFFICER_UPSERT",
      status: "FAILED",
      reason: error instanceof Error ? error.message : "Unknown error",
      metadata: { employeeId: parsed.data.employeeId },
    });
    return handleError(res, error, "Failed to save officer");
  }
  }
);

app.get("/offline/admin/officers", requireAuth, requireAdmin, async (_req, res) => {
  const officers = await prisma.boothOfficer.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return res.json({
    items: officers.map((officer) => ({
      id: officer.id,
      fullName: officer.fullName,
      employeeId: officer.employeeId,
      isActive: officer.isActive,
      lastSeenAt: officer.lastSeenAt,
      createdAt: officer.createdAt,
      updatedAt: officer.updatedAt,
    })),
  });
});

app.get("/offline/admin/profiles", requireAuth, requireAdmin, async (_req, res) => {
  const profiles = await prisma.offlineProfile.findMany({
    include: { user: true },
    orderBy: { updatedAt: "desc" },
  });

  return res.json({
    items: profiles.map((profile: ProfileWithUser) => ({
      id: profile.id,
      userId: profile.userId,
      fullName: profile.user.fullName,
      email: profile.user.email,
      nid: profile.user.nid,
      kycStatus: profile.user.kycStatus,
      walletAddress: profile.user.walletAddress,
      pinSetupRequired: profile.pinSetupRequired,
      failedPinAttempts: profile.failedPinAttempts,
      blockedUntil: profile.blockedUntil,
      lastSeenAt: profile.lastSeenAt,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    })),
  });
});

app.get("/offline/admin/audit", requireAuth, requireAdmin, async (req, res) => {
  const parsed = z.coerce.number().int().min(1).max(500).safeParse(req.query.limit ?? 100);
  const limit = parsed.success ? parsed.data : 100;
  const events = await prisma.offlineAuditEvent.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
  });
  return res.json({ items: events });
});

const start = async () => {
  app.listen(env.port, () => {
    console.log(`Offline API v2 running on http://localhost:${env.port}`);
  });
};

start().catch((error) => {
  console.error("Failed to start Offline API v2", error);
  process.exit(1);
});
