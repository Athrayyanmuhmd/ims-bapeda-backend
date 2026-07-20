import { Response } from "express";
import { ok, paginated, fail } from "../../lib/response";
import { parsePagination } from "../../lib/pagination";
import { AuthRequest } from "../../middleware/auth";
import * as divisiService from "./service";

export const listDivisi = async (req: AuthRequest, res: Response) => {
  const { rows, skip, orderKey, orderRule, searchFilters } = parsePagination(req);

  const result = await divisiService.listDivisi({ skip, rows, orderKey, orderRule, searchFilters });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  paginated(res, result.data.entries, result.data.totalData, result.data.totalPage);
};

export const getDivisiDetail = async (req: AuthRequest, res: Response) => {
  const result = await divisiService.getDivisiDetail(req.params.id as string);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const createDivisi = async (req: AuthRequest, res: Response) => {
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name) { fail(res, "Nama divisi wajib diisi"); return; }

  const result = await divisiService.createDivisi(name, description);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Divisi berhasil dibuat");
};

export const updateDivisi = async (req: AuthRequest, res: Response) => {
  const { name, description } = req.body as { name?: string; description?: string };

  const result = await divisiService.updateDivisi(req.params.id as string, name, description);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Divisi berhasil diupdate");
};

export const deleteDivisi = async (req: AuthRequest, res: Response) => {
  const result = await divisiService.deleteDivisi(req.params.id as string);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, null, "Divisi berhasil dihapus");
};
