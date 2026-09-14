import { Response } from "express";
import { ok, paginated, fail } from "../../lib/response";
import { parsePagination } from "../../lib/pagination";
import { AuthRequest, pembimbingScope } from "../../middleware/auth";
import * as jurnalService from "./service";

export const listJurnal = async (req: AuthRequest, res: Response) => {
  const { rows, skip, orderKey, orderRule, searchFilters, filters } = parsePagination(req);
  const pesertaMagangId = typeof filters.pesertaMagangId === "string" ? filters.pesertaMagangId : undefined;

  const result = await jurnalService.listJurnal(
    { skip, rows, orderKey, orderRule, searchFilters },
    pesertaMagangId,
    pembimbingScope(req)
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  paginated(res, result.data.entries, result.data.totalData, result.data.totalPage);
};

export const getJurnalDetail = async (req: AuthRequest, res: Response) => {
  const result = await jurnalService.getJurnalDetail(req.params.id as string, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const createJurnal = async (req: AuthRequest, res: Response) => {
  const { pesertaMagangId, tanggal, kegiatan } = req.body as {
    pesertaMagangId?: string; tanggal?: string; kegiatan?: string;
  };

  if (!pesertaMagangId || !tanggal || !kegiatan) {
    fail(res, "Peserta magang, tanggal, dan kegiatan wajib diisi"); return;
  }

  const result = await jurnalService.createJurnal(
    { pesertaMagangId, tanggal, kegiatan },
    pembimbingScope(req)
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Jurnal berhasil dibuat");
};

export const updateJurnal = async (req: AuthRequest, res: Response) => {
  const { tanggal, kegiatan } = req.body as { tanggal?: string; kegiatan?: string };

  const result = await jurnalService.updateJurnal(
    req.params.id as string,
    { tanggal, kegiatan },
    pembimbingScope(req)
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Jurnal berhasil diupdate");
};

export const deleteJurnal = async (req: AuthRequest, res: Response) => {
  const result = await jurnalService.deleteJurnal(req.params.id as string, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, null, "Jurnal berhasil dihapus");
};
