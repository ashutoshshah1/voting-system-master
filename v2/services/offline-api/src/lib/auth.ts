import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { env } from "./env.js";

export type AuthPayload = {
  sub: string;
  role: "USER" | "ADMIN";
};

export type OfflinePrecheckPayload = {
  sub: string;
  offlineProfileId: string;
  scope: "OFFLINE_PRECHECK";
};

export type OfflineSessionPayload = {
  sub: string;
  offlineProfileId: string;
  attestationId?: string;
  officerId?: string;
  scope: "OFFLINE_VOTE";
};

export const signOfflinePrecheck = (payload: { sub: string; offlineProfileId: string }) =>
  jwt.sign(
    {
      sub: payload.sub,
      offlineProfileId: payload.offlineProfileId,
      scope: "OFFLINE_PRECHECK",
    } satisfies OfflinePrecheckPayload,
    env.offlineJwtSecret,
    { expiresIn: `${env.offlinePrecheckMinutes}m` }
  );

export const verifyOfflinePrecheck = (token: string) =>
  jwt.verify(token, env.offlineJwtSecret) as OfflinePrecheckPayload;

export const signOfflineSession = (payload: {
  sub: string;
  offlineProfileId: string;
  attestationId?: string;
  officerId?: string;
}) =>
  {
    const tokenPayload: OfflineSessionPayload = {
      sub: payload.sub,
      offlineProfileId: payload.offlineProfileId,
      scope: "OFFLINE_VOTE",
    };
    if (payload.attestationId) {
      tokenPayload.attestationId = payload.attestationId;
    }
    if (payload.officerId) {
      tokenPayload.officerId = payload.officerId;
    }
    return jwt.sign(tokenPayload, env.offlineJwtSecret, {
      expiresIn: `${env.offlineSessionMinutes}m`,
    });
  };

export const verifyOfflineSession = (token: string) =>
  jwt.verify(token, env.offlineJwtSecret) as OfflineSessionPayload;

export const requireAuth = (
  req: Request & { user?: AuthPayload },
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.replace("Bearer ", "").trim();
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireAdmin = (
  req: Request & { user?: AuthPayload },
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
  }
  return next();
};
