import { Kehadiran } from "@prisma/client";
import { Response } from "express";
import { ok, paginated, fail } from "../../lib/response";
import { parsePagination } from "../../lib/pagination";
import { AuthRequest, pembimbingScope } from "../../middleware/auth";
import * as absensiService from "./service";

export const listAbsensi = async (req: AuthRequest, res: Response) => {
  const { rows, skip, orderKey, orderRule, searchFilters, filters } = parsePagination(req);
  const asString = (value: unknown) => (typeof value === "string" && value ? value : undefined);

  const result = await absensiService.listAbsensi(
    { skip, rows, orderKey, orderRule, searchFilters },
    {
      tanggal: asString(filters.tanggal),
      dariTanggal: asString(filters.dariTanggal),
      sampaiTanggal: asString(filters.sampaiTanggal),
      pesertaMagangId: asString(filters.pesertaMagangId),
      izinStatus: asString(filters.izinStatus) as
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | undefined,
    },
    pembimbingScope(req)
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  paginated(res, result.data.entries, result.data.totalData, result.data.totalPage);
};

export const listPendingIzin = async (req: AuthRequest, res: Response) => {
  const result = await absensiService.listPendingIzin(pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const getAbsensiDetail = async (req: AuthRequest, res: Response) => {
  const result = await absensiService.getAbsensiDetail(req.params.id as string, pembimbingScope(req));
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

  if (!Object.values(Kehadiran).includes(kehadiran as Kehadiran)) {
    fail(res, `Kehadiran tidak valid. Pilihan: ${Object.values(Kehadiran).join(", ")}`); return;
  }

  const result = await absensiService.createAbsensi(
    { pesertaMagangId, kehadiran: kehadiran as Kehadiran, tanggal, jamMasuk, jamKeluar, keterangan },
    pembimbingScope(req)
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Absensi berhasil dibuat");
};

export const updateAbsensi = async (req: AuthRequest, res: Response) => {
  const { kehadiran, tanggal, jamMasuk, jamKeluar, keterangan } = req.body as {
    kehadiran?: string; tanggal?: string;
    jamMasuk?: string; jamKeluar?: string; keterangan?: string;
  };

  if (kehadiran && !Object.values(Kehadiran).includes(kehadiran as Kehadiran)) {
    fail(res, `Kehadiran tidak valid. Pilihan: ${Object.values(Kehadiran).join(", ")}`); return;
  }

  const result = await absensiService.updateAbsensi(req.params.id as string, {
    kehadiran: kehadiran as Kehadiran | undefined,
    tanggal,
    jamMasuk,
    jamKeluar,
    keterangan,
  }, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Absensi berhasil diupdate");
};

export const approveIzin = async (req: AuthRequest, res: Response) => {
  if (!req.userId) { fail(res, "Unauthorized", null, 401); return; }

  const result = await absensiService.approveIzin(
    req.params.id as string,
    req.userId,
    pembimbingScope(req)
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data, "Pengajuan izin disetujui");
};

export const rejectIzin = async (req: AuthRequest, res: Response) => {
  if (!req.userId) { fail(res, "Unauthorized", null, 401); return; }

  const { catatan } = req.body as { catatan?: string };

  const result = await absensiService.rejectIzin(
    req.params.id as string,
    req.userId,
    pembimbingScope(req),
    catatan
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data, "Pengajuan izin ditolak");
};

export const deleteAbsensi = async (req: AuthRequest, res: Response) => {
  const result = await absensiService.deleteAbsensi(req.params.id as string, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, null, "Absensi berhasil dihapus");
};
