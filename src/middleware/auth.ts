import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { fail } from "../lib/response";
import * as authRepository from "../routes/auth/repository";

export interface AuthRequest extends Request {
  userId?: string;
  role?: string;
}

// Staff and peserta tokens are signed with the same secret, so the audience has
// to be checked explicitly — otherwise a peserta's token would sail straight
// through the staff middleware. Legacy staff tokens predate the claim, hence the
// undefined allowance; a peserta token always carries "peserta" and so is
// rejected here either way.
export const STAFF_TOKEN_TYPE = "user";
export const PESERTA_TOKEN_TYPE = "peserta";

const isStaffToken = (typ?: string) => typ === STAFF_TOKEN_TYPE || typ === undefined;

// Role and status are read from the DB on every request instead of being taken
// from the JWT claims. A token stays cryptographically valid for 7 days, so
// trusting its claims meant a deactivated account kept full access and a role
// change didn't apply until the token expired.
// ponytail: one indexed primary-key lookup per request. Cache it (Redis, or a
// short in-process TTL) only if it ever shows up in latency numbers.
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    fail(res, "Unauthorized", null, 401);
    return;
  }

  let payload: { sub: string; typ?: string };
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; typ?: string };
  } catch {
    fail(res, "Token tidak valid atau sudah expired", null, 401);
    return;
  }

  // A peserta portal token must never reach a staff endpoint.
  if (!isStaffToken(payload.typ)) {
    fail(res, "Token tidak valid atau sudah expired", null, 401);
    return;
  }

  const user = await authRepository.findByIdBasic(payload.sub);

  // Same message as an invalid token: a deleted account shouldn't be
  // distinguishable from a bad token by the response.
  if (!user) {
    fail(res, "Token tidak valid atau sudah expired", null, 401);
    return;
  }

  if (user.status !== "active") {
    fail(res, "Akun tidak aktif", null, 403);
    return;
  }

  req.userId = user.id;
  req.role = user.role?.name ?? undefined;
  next();
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.role || !roles.includes(req.role)) {
      fail(res, "Anda tidak memiliki akses untuk aksi ini", null, 403);
      return;
    }
    next();
  };
};

export const STAFF_OPS_ROLES = ["Admin", "Pembimbing"] as const;

// Admin sees every peserta magang; everyone else is limited to the peserta they
// supervise as pembimbing lapangan. Returns the user id to filter by, or
// undefined for "no filter" (Admin only).
//
// Deny-by-default is deliberate: a role with no binaan (e.g. plain "User")
// scopes to its own id and therefore sees nothing, rather than everything.
// Operational routers should also gate with requireRole(...STAFF_OPS_ROLES)
// so non-ops roles cannot call those APIs at all.
export const pembimbingScope = (req: AuthRequest): string | undefined =>
  req.role === "Admin" ? undefined : req.userId;
