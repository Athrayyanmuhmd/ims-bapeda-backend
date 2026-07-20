import { Response } from "express";
import { ok, paginated, fail } from "../../lib/response";
import { parsePagination } from "../../lib/pagination";
import { AuthRequest } from "../../middleware/auth";
import * as roleService from "./service";

export const listRoles = async (req: AuthRequest, res: Response) => {
  const { rows, skip, orderKey, orderRule, searchFilters } = parsePagination(req);

  const result = await roleService.listRoles({ skip, rows, orderKey, orderRule, searchFilters });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  paginated(res, result.data.entries, result.data.totalData, result.data.totalPage);
};

export const getRoleDetail = async (req: AuthRequest, res: Response) => {
  const result = await roleService.getRoleDetail(req.params.id as string);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const createRole = async (req: AuthRequest, res: Response) => {
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name) { fail(res, "Nama role wajib diisi"); return; }

  const result = await roleService.createRole(name, description);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Role berhasil dibuat");
};

export const updateRole = async (req: AuthRequest, res: Response) => {
  const { name, description } = req.body as { name?: string; description?: string };

  const result = await roleService.updateRole(req.params.id as string, name, description);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Role berhasil diupdate");
};

export const deleteRole = async (req: AuthRequest, res: Response) => {
  const result = await roleService.deleteRole(req.params.id as string);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, null, "Role berhasil dihapus");
};
