import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import { fail } from "../lib/response";
import { PESERTA_TOKEN_TYPE } from "./auth";

export interface PesertaRequest extends Request {
  pesertaMagangId?: string;
}

// The mirror of `authenticate`, for the peserta portal. Deliberately a separate
// middleware rather than a flag on the staff one: the two must not be able to
// drift into accepting each other's tokens.
//
// Like the staff side, the record is re-read on every request — so revoking
// portal access (password set back to null) or closing the magang takes effect
// immediately instead of waiting out the 7-day token.
export const authenticatePeserta = async (
  req: PesertaRequest,
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

  // Exact match, with no undefined allowance: a staff token must never be usable
  // here either, even though this route set is narrower.
  if (payload.typ !== PESERTA_TOKEN_TYPE) {
    fail(res, "Token tidak valid atau sudah expired", null, 401);
    return;
  }

  const peserta = await prisma.pesertaMagang
    .findUnique({
      where: { id: payload.sub },
      select: { id: true, password: true, status: true },
    })
    .catch((error) => {
      console.error("authenticatePeserta db lookup failed", error);
      fail(res, "Tidak dapat mengakses database. Coba lagi sebentar.", null, 503);
      return null;
    });

  if (res.headersSent) return;

  if (!peserta) {
    fail(res, "Token tidak valid atau sudah expired", null, 401);
    return;
  }

  // Clearing the password is how staff revoke portal access.
  if (!peserta.password) {
    fail(res, "Akun portal tidak aktif", null, 403);
    return;
  }

  if (peserta.status !== "AKTIF") {
    fail(res, "Magang Anda sudah tidak aktif", null, 403);
    return;
  }

  req.pesertaMagangId = peserta.id;
  next();
};
