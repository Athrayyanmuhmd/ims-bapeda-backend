import { Request, Response, NextFunction } from "express";
import { fail } from "./response";

// ponytail: in-memory, per-process. Fine for a single instance; move to a
// shared store (Redis) if this ever runs behind multiple server processes.
export const rateLimit = (windowMs: number, max: number) => {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= max) {
      fail(res, "Terlalu banyak percobaan, coba lagi nanti", null, 429);
      return;
    }

    entry.count += 1;
    next();
  };
};
