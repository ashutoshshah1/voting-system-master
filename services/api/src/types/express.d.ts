import type { AuthPayload } from "../lib/auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export {};
