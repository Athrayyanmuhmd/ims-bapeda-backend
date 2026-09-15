import { Response } from "express";
import { ok, paginated, fail } from "../../lib/response";
import { parsePagination } from "../../lib/pagination";
import { AuthRequest } from "../../middleware/auth";
import { isValidEmail, isValidPhoneId } from "../../lib/validate";
import * as userService from "./service";

// GET all users (also accepts POST with body.params from frontend legacy pattern)
export const listUsers = async (req: AuthRequest, res: Response) => {
  const { rows, skip, orderKey, orderRule, searchFilters } = parsePagination(req);

  const result = await userService.listUsers({ skip, rows, orderKey, orderRule, searchFilters });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  paginated(res, result.data.entries, result.data.totalData, result.data.totalPage);
};

// Always acts on req.userId — the target is never taken from the request, so
// this can't be pointed at another account.
export const updateOwnProfile = async (req: AuthRequest, res: Response) => {
  const { fullName, phoneNumber, currentPassword, newPassword } = req.body as {
    fullName?: string;
    phoneNumber?: string | null;
    currentPassword?: string;
    newPassword?: string;
  };

  if (!fullName?.trim()) {
    fail(res, "Nama wajib diisi");
    return;
  }

  if (phoneNumber && !isValidPhoneId(phoneNumber)) {
    fail(res, "Format nomor HP tidak valid (contoh: 081234567890)");
    return;
  }

  const result = await userService.updateOwnProfile(req.userId as string, {
    fullName,
    phoneNumber,
    currentPassword,
    newPassword,
  });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Profil berhasil diperbarui");
};

export const changeOwnPassword = async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    fail(res, "Password saat ini dan password baru wajib diisi");
    return;
  }

  const result = await userService.changeOwnPassword(
    req.userId as string,
    currentPassword,
    newPassword
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, null, "Password berhasil diubah");
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
  if (phoneNumber && !isValidPhoneId(phoneNumber)) {
    fail(res, "Format nomor HP tidak valid (contoh: 081234567890)");
    return;
  }

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
  if (phoneNumber && !isValidPhoneId(phoneNumber)) {
    fail(res, "Format nomor HP tidak valid (contoh: 081234567890)");
    return;
  }

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
