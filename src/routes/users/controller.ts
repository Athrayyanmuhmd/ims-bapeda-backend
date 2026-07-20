import { Response } from "express";
import { ok, paginated, fail } from "../../lib/response";
import { parsePagination } from "../../lib/pagination";
import { AuthRequest } from "../../middleware/auth";
import { isValidEmail } from "../../lib/validate";
import * as userService from "./service";

// GET all users (also accepts POST with body.params from frontend legacy pattern)
export const listUsers = async (req: AuthRequest, res: Response) => {
  const { rows, skip, orderKey, orderRule, searchFilters } = parsePagination(req);

  const result = await userService.listUsers({ skip, rows, orderKey, orderRule, searchFilters });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  paginated(res, result.data.entries, result.data.totalData, result.data.totalPage);
};

// Used by both GET /:id and legacy POST /detail/:id
export const getUserDetail = async (req: AuthRequest, res: Response) => {
  const result = await userService.getUserDetail(req.params.id as string);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const createUser = async (req: AuthRequest, res: Response) => {
  const { fullName, email, password, phoneNumber, divisiId, roleId } = req.body as {
    fullName?: string; email?: string; password?: string;
    phoneNumber?: string; divisiId?: string; roleId?: string;
  };

  if (!fullName || !email || !password) {
    fail(res, "Nama, email, dan password wajib diisi"); return;
  }
  if (!isValidEmail(email)) { fail(res, "Format email tidak valid"); return; }
  if (password.length < 8) { fail(res, "Password minimal 8 karakter"); return; }

  const result = await userService.createUser({ fullName, email, password, phoneNumber, divisiId, roleId });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "User berhasil dibuat");
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  const { fullName, email, phoneNumber, divisiId, roleId, status, password } = req.body as {
    fullName?: string; email?: string; phoneNumber?: string;
    divisiId?: string; roleId?: string; status?: string; password?: string;
  };

  if (email && !isValidEmail(email)) { fail(res, "Format email tidak valid"); return; }
  if (password && password.length < 8) { fail(res, "Password minimal 8 karakter"); return; }

  const result = await userService.updateUser(req.params.id as string, {
    fullName, email, phoneNumber, divisiId, roleId, status, password,
  });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "User berhasil diupdate");
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  const result = await userService.deleteUser(req.params.id as string);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, null, "User berhasil dihapus");
};
