import { Response } from "express";
import { ok, paginated, fail } from "../../lib/response";
import { parsePagination } from "../../lib/pagination";
import { AuthRequest, pembimbingScope } from "../../middleware/auth";
import * as logbookService from "./service";

export const listLogbook = async (req: AuthRequest, res: Response) => {
  const { rows, skip, orderKey, orderRule, searchFilters, filters } = parsePagination(req);
  const pesertaMagangId = typeof filters.pesertaMagangId === "string" ? filters.pesertaMagangId : undefined;

  const result = await logbookService.listLogbook(
    { skip, rows, orderKey, orderRule, searchFilters },
    pesertaMagangId,
    pembimbingScope(req)
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  paginated(res, result.data.entries, result.data.totalData, result.data.totalPage);
};

export const getLogbookDetail = async (req: AuthRequest, res: Response) => {
  const result = await logbookService.getLogbookDetail(req.params.id as string, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const createLogbook = async (req: AuthRequest, res: Response) => {
  const { pesertaMagangId, tanggal, kegiatan } = req.body as {
    pesertaMagangId?: string; tanggal?: string; kegiatan?: string;
  };

  if (!pesertaMagangId || !tanggal || !kegiatan) {
    fail(res, "Peserta magang, tanggal, dan kegiatan wajib diisi"); return;
  }

  const result = await logbookService.createLogbook(
    { pesertaMagangId, tanggal, kegiatan },
    pembimbingScope(req)
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Logbook berhasil dibuat");
};

export const updateLogbook = async (req: AuthRequest, res: Response) => {
  const { tanggal, kegiatan } = req.body as { tanggal?: string; kegiatan?: string };

  const result = await logbookService.updateLogbook(
    req.params.id as string,
    { tanggal, kegiatan },
    pembimbingScope(req)
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Logbook berhasil diupdate");
};

export const deleteLogbook = async (req: AuthRequest, res: Response) => {
  const result = await logbookService.deleteLogbook(req.params.id as string, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, null, "Logbook berhasil dihapus");
};
