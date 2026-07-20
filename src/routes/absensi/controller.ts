import { Response } from "express";
import { ok, paginated, fail } from "../../lib/response";
import { parsePagination } from "../../lib/pagination";
import { AuthRequest } from "../../middleware/auth";
import * as absensiService from "./service";

export const listAbsensi = async (req: AuthRequest, res: Response) => {
  const { rows, skip, orderKey, orderRule, searchFilters, filters } = parsePagination(req);
  const tanggal = typeof filters.tanggal === "string" ? filters.tanggal : undefined;
  const pesertaMagangId = typeof filters.pesertaMagangId === "string" ? filters.pesertaMagangId : undefined;

  const result = await absensiService.listAbsensi(
    { skip, rows, orderKey, orderRule, searchFilters },
    { tanggal, pesertaMagangId }
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  paginated(res, result.data.entries, result.data.totalData, result.data.totalPage);
};

export const getAbsensiDetail = async (req: AuthRequest, res: Response) => {
  const result = await absensiService.getAbsensiDetail(req.params.id as string);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const createAbsensi = async (req: AuthRequest, res: Response) => {
  const { pesertaMagangId, kehadiran, tanggal, jamMasuk, jamKeluar, keterangan } = req.body as {
    pesertaMagangId?: string; kehadiran?: string; tanggal?: string;
    jamMasuk?: string; jamKeluar?: string; keterangan?: string;
  };

  if (!pesertaMagangId || !kehadiran || !tanggal) {
    fail(res, "PesertaMagangId, kehadiran, dan tanggal wajib diisi"); return;
  }

  const result = await absensiService.createAbsensi({ pesertaMagangId, kehadiran, tanggal, jamMasuk, jamKeluar, keterangan });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Absensi berhasil dibuat");
};

export const updateAbsensi = async (req: AuthRequest, res: Response) => {
  const { kehadiran, tanggal, jamMasuk, jamKeluar, keterangan } = req.body as {
    kehadiran?: string; tanggal?: string;
    jamMasuk?: string; jamKeluar?: string; keterangan?: string;
  };

  const result = await absensiService.updateAbsensi(req.params.id as string, {
    kehadiran, tanggal, jamMasuk, jamKeluar, keterangan,
  });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Absensi berhasil diupdate");
};

export const deleteAbsensi = async (req: AuthRequest, res: Response) => {
  const result = await absensiService.deleteAbsensi(req.params.id as string);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, null, "Absensi berhasil dihapus");
};
