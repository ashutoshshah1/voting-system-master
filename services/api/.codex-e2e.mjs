import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  S3Client,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import { ethers } from "ethers";

const baseUrl = process.env.API_URL || "http://localhost:4000";
const offlineBaseUrl = process.env.OFFLINE_API_URL || "http://localhost:4100";
const timeoutMs = 180_000;

const results = [];
const record = (name, ok, info) => {
  const line = `${ok ? "OK" : "FAIL"} ${name}${info ? ` - ${info}` : ""}`;
  console.log(line);
  results.push({ name, ok, info: info || "" });
};

const request = async (
  path,
  { method = "GET", token, body, form, rootUrl = baseUrl } = {}
) => {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${rootUrl}${path}`, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!response.ok) {
      const detail =
        typeof data === "string" ? data : JSON.stringify(data || {});
      throw new Error(`HTTP ${response.status}: ${detail}`);
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
};

const requestBinary = async (path, token) => {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
  } finally {
    clearTimeout(timeoutId);
  }
};

const parseKeyFromUrl = (url) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const bucket = process.env.MINIO_BUCKET;
    if (!bucket) return null;
    const prefix = `/${bucket}/`;
    if (!parsed.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(parsed.pathname.slice(prefix.length));
  } catch {
    return null;
  }
};

const buildTestNid = (seed, offset) => {
  const base = (BigInt(seed) + BigInt(offset)) % 1_000_000_000n;
  return `1${base.toString().padStart(9, "0")}`;
};

const ensureElectionOpen = async (adminToken) => {
  try {
    await request("/admin/election/status", {
      method: "POST",
      token: adminToken,
      body: { active: true },
    });
    return { reopened: false };
  } catch (error) {
    if (!`${error?.message || ""}`.includes("Results already published")) {
      throw error;
    }
  }

  await request("/admin/election/reset", {
    method: "POST",
    token: adminToken,
  });
  await request("/admin/election/status", {
    method: "POST",
    token: adminToken,
    body: { active: true },
  });
  return { reopened: true };
};

const run = async () => {
  const suffix = `${Date.now()}-${randomBytes(2).toString("hex")}`;
  const nidSeed = `${Date.now()}`.slice(-9);
  const offlineRfidUid = `RFID${randomBytes(4).toString("hex").toUpperCase()}`;
  const offlinePin = "482951";
  const adminEmail = `codex-admin-${suffix}@example.com`;
  const adminNid = buildTestNid(nidSeed, 0);
  const adminDob = "1988-01-01";
  const userEmail = `codex-user-${suffix}@example.com`;
  const userNid = buildTestNid(nidSeed, 1);
  const userDob = "1995-05-05";
  const rejectEmail = `codex-reject-${suffix}@example.com`;
  const rejectNid = buildTestNid(nidSeed, 2);
  const rejectDob = "1992-02-02";

  const state = {
    adminEmail,
    userEmail,
    rejectEmail,
    userId: null,
    rejectUserId: null,
    candidateId: null,
    userDocUrl: null,
    rejectDocUrl: null,
    adminToken: null,
    userToken: null,
    walletAddress: null,
    didReset: false,
  };

  const prisma = new PrismaClient();

  try {
    const health = await request("/health");
    record("Health check", health?.status === "ok");

    const adminRegister = await request("/auth/register", {
      method: "POST",
      body: {
        fullName: "Codex Admin",
        email: adminEmail,
        nid: adminNid,
        dob: adminDob,
      },
    });
    record("Register admin", !!adminRegister?.user?.id);

    await prisma.user.updateMany({
      where: { email: adminEmail },
      data: { role: "ADMIN" },
    });
    record("Promote admin", true);

    const adminLogin = await request("/auth/login", {
      method: "POST",
      body: { nid: adminNid, dob: adminDob },
    });
    state.adminToken = adminLogin?.token;
    record("Admin login", !!state.adminToken);

    const electionOpen = await ensureElectionOpen(state.adminToken);
    record(
      "Ensure election open",
      true,
      electionOpen.reopened ? "Reset before reopening" : ""
    );

    const userRegister = await request("/auth/register", {
      method: "POST",
      body: {
        fullName: "Codex Voter",
        email: userEmail,
        nid: userNid,
        dob: userDob,
      },
    });
    state.userId = userRegister?.user?.id ?? null;
    record("Register voter", !!state.userId);

    const userLogin = await request("/auth/login", {
      method: "POST",
      body: { nid: userNid, dob: userDob },
    });
    state.userToken = userLogin?.token;
    record("Voter login", !!state.userToken);

    const rejectRegister = await request("/auth/register", {
      method: "POST",
      body: {
        fullName: "Codex Reject",
        email: rejectEmail,
        nid: rejectNid,
        dob: rejectDob,
      },
    });
    state.rejectUserId = rejectRegister?.user?.id ?? null;
    record("Register reject voter", !!state.rejectUserId);

    const rejectLogin = await request("/auth/login", {
      method: "POST",
      body: { nid: rejectNid, dob: rejectDob },
    });
    const rejectToken = rejectLogin?.token;
    record("Reject voter login", !!rejectToken);

    const kycForm = new FormData();
    kycForm.append("documentType", "NID");
    kycForm.append(
      "document",
      new Blob([`Demo KYC for ${userEmail}`], { type: "text/plain" }),
      "kyc.txt"
    );
    const kycSubmit = await request("/kyc/submit", {
      method: "POST",
      token: state.userToken,
      form: kycForm,
    });
    state.userDocUrl = kycSubmit?.documentUrl ?? null;
    record("Submit KYC (approve)", !!kycSubmit?.id);

    const rejectForm = new FormData();
    rejectForm.append("documentType", "NID");
    rejectForm.append(
      "document",
      new Blob([`Demo KYC for ${rejectEmail}`], { type: "text/plain" }),
      "kyc-reject.txt"
    );
    const rejectKycSubmit = await request("/kyc/submit", {
      method: "POST",
      token: rejectToken,
      form: rejectForm,
    });
    state.rejectDocUrl = rejectKycSubmit?.documentUrl ?? null;
    record("Submit KYC (reject)", !!rejectKycSubmit?.id);

    const pending = await request("/admin/kyc/pending", {
      token: state.adminToken,
    });
    const pendingIds = new Set((pending || []).map((item) => item.id));
    record(
      "Pending KYC list",
      pendingIds.has(kycSubmit.id) && pendingIds.has(rejectKycSubmit.id)
    );

    const kycDoc = await requestBinary(
      `/admin/kyc/${kycSubmit.id}/document`,
      state.adminToken
    );
    record("Fetch KYC document", kycDoc.length > 0);

    const approved = await request(`/admin/kyc/${kycSubmit.id}/approve`, {
      method: "POST",
      token: state.adminToken,
      body: { reviewNote: "Approved in E2E" },
    });
    state.walletAddress = approved?.walletAddress ?? null;
    record("Approve KYC", !!state.walletAddress);

    const rejected = await request(`/admin/kyc/${rejectKycSubmit.id}/reject`, {
      method: "POST",
      token: state.adminToken,
      body: { reviewNote: "Rejected in E2E" },
    });
    record("Reject KYC", rejected?.status === "REJECTED");

    const me = await request("/me", { token: state.userToken });
    record("Get /me", me?.kycStatus === "APPROVED");

    const walletBalance = await request("/wallet/balance", {
      token: state.userToken,
    });
    record("Wallet balance", !!walletBalance?.walletAddress);

    const candidateForm = new FormData();
    candidateForm.append("name", "Codex Demo Candidate");
    candidateForm.append("party", "Codex Party");
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/VA9hXQAAAAASUVORK5CYII=",
      "base64"
    );
    candidateForm.append(
      "image",
      new Blob([pngBytes], { type: "image/png" }),
      "candidate.png"
    );
    const candidate = await request("/admin/candidates", {
      method: "POST",
      token: state.adminToken,
      form: candidateForm,
    });
    state.candidateId = candidate?.candidateId ?? null;
    record("Add candidate", Number.isInteger(state.candidateId));

    const candidates = await request("/candidates");
    const candidateEntry = (candidates?.items || []).find(
      (item) => item.candidateId === state.candidateId
    );
    record("Fetch candidates", !!candidateEntry);

    if (candidateEntry?.imageUrl) {
      const image = await requestBinary(
        `/candidates/${state.candidateId}/image`
      );
      record("Fetch candidate image", image.length > 0);
    } else {
      record("Fetch candidate image", false, "No image URL");
    }

    await request("/admin/voters/eligibility", {
      method: "POST",
      token: state.adminToken,
      body: { walletAddress: state.walletAddress, eligible: false },
    });
    record("Set eligibility false", true);

    await request("/admin/voters/eligibility", {
      method: "POST",
      token: state.adminToken,
      body: { walletAddress: state.walletAddress, eligible: true },
    });
    record("Set eligibility true", true);

    const voters = await request("/admin/voters", {
      token: state.adminToken,
    });
    const voterEntry = (voters?.voters || []).find(
      (item) => item.email === userEmail
    );
    record("Admin voters list", !!voterEntry);

    const vote = await request("/vote", {
      method: "POST",
      token: state.userToken,
      body: { candidateId: state.candidateId },
    });
    record("Submit vote", !!vote?.txHash);

    const offlineLink = await request("/offline/profiles/link-online", {
      method: "POST",
      rootUrl: offlineBaseUrl,
      body: {
        rfidUid: offlineRfidUid,
        nid: userNid,
        dob: userDob,
        pin: offlinePin,
      },
    });
    record("Link offline profile", !!offlineLink?.offlineProfile?.id);

    const offlineSession = await request("/offline/session/start", {
      method: "POST",
      rootUrl: offlineBaseUrl,
      body: { rfidUid: offlineRfidUid },
    });
    const sessionToken = offlineSession?.sessionToken ?? null;
    record("Start offline session", !!sessionToken);

    let offlineVoteBlocked = false;
    let offlineVoteInfo = "";
    try {
      await request("/offline/vote", {
        method: "POST",
        rootUrl: offlineBaseUrl,
        body: {
          sessionToken,
          pin: offlinePin,
          candidateId: state.candidateId,
        },
      });
      offlineVoteInfo = "Offline vote unexpectedly succeeded";
    } catch (error) {
      offlineVoteBlocked = `${error?.message || ""}`.includes(
        "Vote already recorded for this wallet"
      );
      offlineVoteInfo = error?.message || "Offline duplicate-vote check failed";
    }
    record("Block duplicate offline vote", offlineVoteBlocked, offlineVoteInfo);

    const close = await request("/admin/election/status", {
      method: "POST",
      token: state.adminToken,
      body: { active: false },
    });
    record("Close election", !!close?.txHash);

    const publish = await request("/admin/results/publish", {
      method: "POST",
      token: state.adminToken,
    });
    record("Publish results", !!publish?.txHash);

    const rpcRaw = process.env.RPC_URLS || process.env.RPC_URL || "";
    const rpcUrl = rpcRaw.split(",").map((url) => url.trim()).filter(Boolean)[0];
    const contractAddress = process.env.CONTRACT_ADDRESS || "";
    if (!rpcUrl || !ethers.isAddress(contractAddress)) {
      throw new Error("Missing RPC_URL/CONTRACT_ADDRESS for on-chain checks");
    }
    const abiPath = new URL("./src/contracts/abi.json", import.meta.url);
    const abi = JSON.parse(await fs.readFile(abiPath, "utf8"));
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, abi, provider);
    const published = await contract.resultsPublished();
    record("On-chain resultsPublished", published === true);
    const chainResults = await contract.getResults();
    const normalized = chainResults.map((item) => ({
      candidateId: Number(item.candidateId ?? item[0]),
      votes: Number(item.votes ?? item[1]),
    }));
    const candidateResult = normalized.find(
      (item) => item.candidateId === state.candidateId
    );
    record("On-chain results include vote", candidateResult?.votes === 1);

    const reset = await request("/admin/election/reset", {
      method: "POST",
      token: state.adminToken,
    });
    state.didReset = !!reset?.txHash;
    record("Reset election", state.didReset);
  } catch (error) {
    record("E2E run", false, error?.message || "Unknown error");
  } finally {
    try {
      if (!state.didReset && state.adminToken) {
        await request("/admin/election/reset", {
          method: "POST",
          token: state.adminToken,
        });
        record("Reset election (cleanup)", true);
      }
    } catch (error) {
      record("Reset election (cleanup)", false, error?.message || "Failed");
    }

    const s3Keys = [];
    const userKey = parseKeyFromUrl(state.userDocUrl);
    const rejectKey = parseKeyFromUrl(state.rejectDocUrl);
    if (userKey) s3Keys.push({ Key: userKey });
    if (rejectKey) s3Keys.push({ Key: rejectKey });

    try {
      if (state.candidateId) {
        const asset = await prisma.candidateAsset.findUnique({
          where: { candidateId: state.candidateId },
        });
        if (asset?.imageKey) {
          s3Keys.push({ Key: asset.imageKey });
        }
      }
    } catch (error) {
      record("Lookup candidate assets", false, error?.message || "Failed");
    }

    try {
      if (s3Keys.length) {
        const s3 = new S3Client({
          region: "us-east-1",
          endpoint: `${process.env.MINIO_USE_SSL === "true" ? "https" : "http"}://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
          credentials: {
            accessKeyId: process.env.MINIO_ACCESS_KEY,
            secretAccessKey: process.env.MINIO_SECRET_KEY,
          },
          forcePathStyle: true,
        });
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: process.env.MINIO_BUCKET,
            Delete: { Objects: s3Keys, Quiet: true },
          })
        );
        record("Clean MinIO objects", true);
      } else {
        record("Clean MinIO objects", true, "No objects to delete");
      }
    } catch (error) {
      record("Clean MinIO objects", false, error?.message || "Failed");
    }

    try {
      const userIds = [state.userId, state.rejectUserId].filter(Boolean);
      if (userIds.length) {
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM "OfflineAuditEvent" WHERE "userId" IN (${Prisma.join(
            userIds
          )})`
        );
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM "OfflineSessionAttestation" WHERE "offlineProfileId" IN (
            SELECT id FROM "OfflineProfile" WHERE "userId" IN (${Prisma.join(userIds)})
          )`
        );
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM "OfflineProfile" WHERE "userId" IN (${Prisma.join(userIds)})`
        );
        await prisma.kycSubmission.deleteMany({
          where: { userId: { in: userIds } },
        });
      }
      if (state.candidateId) {
        await prisma.candidateAsset.deleteMany({
          where: { candidateId: state.candidateId },
        });
      }
      const emails = [state.adminEmail, state.userEmail, state.rejectEmail];
      await prisma.user.deleteMany({ where: { email: { in: emails } } });
      record("Clean database rows", true);
    } catch (error) {
      record("Clean database rows", false, error?.message || "Failed");
    }

    await prisma.$disconnect();
  }

  const failed = results.filter((item) => !item.ok);
  if (failed.length) {
    process.exitCode = 1;
  }
};

await run();
