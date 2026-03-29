import type { NextFunction, Request, Response } from "express";

type RateLimitOptions = {
  keyPrefix: string;
  windowMs: number;
  max: number;
  message?: string;
  keyFn?: (req: Request) => string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
let requestCountSinceSweep = 0;
const SWEEP_EVERY = 200;

const getClientIp = (req: Request) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0] || "unknown";
  }
  return req.ip || req.socket.remoteAddress || "unknown";
};

const sweepExpiredBuckets = (now: number) => {
  requestCountSinceSweep += 1;
  if (requestCountSinceSweep % SWEEP_EVERY !== 0) {
    return;
  }
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

export const applySecurityHeaders = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
};

export const createRateLimiter = ({
  keyPrefix,
  windowMs,
  max,
  message = "Too many requests. Try again shortly.",
  keyFn,
}: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    sweepExpiredBuckets(now);

    const dynamicKey = keyFn?.(req) || getClientIp(req);
    const bucketKey = `${keyPrefix}:${dynamicKey}`;
    const current = buckets.get(bucketKey);

    if (!current || current.resetAt <= now) {
      const fresh: Bucket = { count: 1, resetAt: now + windowMs };
      buckets.set(bucketKey, fresh);
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - fresh.count)));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(fresh.resetAt / 1000)));
      return next();
    }

    current.count += 1;
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - current.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));

    if (current.count > max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000)
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ message });
    }

    return next();
  };
};

export const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) => {
  if (items.length === 0) {
    return [] as R[];
  }
  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(safeConcurrency, items.length) }, () => worker())
  );

  return results;
};
