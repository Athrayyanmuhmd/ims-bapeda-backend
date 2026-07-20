import { Request, Response } from "express";
import { ok, fail } from "../../lib/response";
import { isValidEmail } from "../../lib/validate";
import * as authService from "./service";

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    fail(res, "Email dan password wajib diisi");
    return;
  }

  if (!isValidEmail(email)) {
    fail(res, "Format email tidak valid");
    return;
  }

  const result = await authService.login(email, password);
  if (!result.ok) {
    fail(res, result.message, null, result.status);
    return;
  }

  ok(res, result.data, "Login berhasil");
};

export const verifyToken = async (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };

  if (!token) {
    fail(res, "Token wajib diisi");
    return;
  }

  const result = await authService.verifyToken(token);
  if (!result.ok) {
    fail(res, result.message, null, result.status);
    return;
  }

  ok(res, result.data, "Token valid");
};
