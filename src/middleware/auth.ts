import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { fail } from "../lib/response";

export interface AuthRequest extends Request {
  userId?: string;
  role?: string;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    fail(res, "Unauthorized", null, 401);
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; role?: string };
    req.userId = payload.sub;
    req.role = payload.role;
    next();
  } catch {
    fail(res, "Token tidak valid atau sudah expired", null, 401);
  }
};

// ponytail: role comes from the JWT claim set at login, not a fresh DB read.
// A role change won't take effect until the token expires (7d) or is reissued.
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.role || !roles.includes(req.role)) {
      fail(res, "Anda tidak memiliki akses untuk aksi ini", null, 403);
      return;
    }
    next();
  };
};
