import { Response } from "express";
import { ok, paginated, fail } from "../../lib/response";
import { parsePagination } from "../../lib/pagination";
import { AuthRequest, pembimbingScope } from "../../middleware/auth";
import * as penilaianService from "./service";

export const listPenilaian = async (req: AuthRequest, res: Response) => {
  const { rows, skip, orderKey, orderRule, searchFilters, filters } = parsePagination(req);
  const asString = (value: unknown) => (typeof value === "string" && value ? value : undefined);

  const result = await penilaianService.listPenilaian(
    { skip, rows, orderKey, orderRule, searchFilters },
    {
      pesertaMagangId: asString(filters.pesertaMagangId),
      divisiId: asString(filters.divisiId),
      instansiId: asString(filters.instansiId),
      pembimbingLapanganId: asString(filters.pembimbingLapanganId),
    },
    pembimbingScope(req)
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  paginated(res, result.data.entries, result.data.totalData, result.data.totalPage);
};

export const getPenilaianDetail = async (req: AuthRequest, res: Response) => {
  const result = await penilaianService.getPenilaianDetail(req.params.id as string, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

// penilaiId is always the logged-in user — never taken from the request body.
export const createPenilaian = async (req: AuthRequest, res: Response) => {
  const { pesertaMagangId, nilai, komentar } = req.body as {
    pesertaMagangId?: string; nilai?: number; komentar?: string;
  };

  if (!pesertaMagangId || nilai === undefined) {
    fail(res, "Peserta magang dan nilai wajib diisi"); return;
  }

  const result = await penilaianService.createPenilaian({
    pesertaMagangId,
    penilaiId: req.userId as string,
    nilai,
    komentar,
  }, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Penilaian berhasil dibuat");
};

export const updatePenilaian = async (req: AuthRequest, res: Response) => {
  const { nilai, komentar } = req.body as { nilai?: number; komentar?: string };

  const result = await penilaianService.updatePenilaian(
    req.params.id as string,
    { nilai, komentar },
    pembimbingScope(req)
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Penilaian berhasil diupdate");
};

export const deletePenilaian = async (req: AuthRequest, res: Response) => {
  const result = await penilaianService.deletePenilaian(req.params.id as string, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, null, "Penilaian berhasil dihapus");
};
