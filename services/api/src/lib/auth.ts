import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { env } from "./env.js";

export type AuthPayload = {
  sub: string;
  role: "USER" | "ADMIN";
};

export const signToken = (payload: AuthPayload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" });

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
