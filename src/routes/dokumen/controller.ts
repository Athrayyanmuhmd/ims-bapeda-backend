import { JenisDokumen } from "@prisma/client";
import { Response } from "express";
import { ok, paginated, fail } from "../../lib/response";
import { parsePagination } from "../../lib/pagination";
import { AuthRequest, pembimbingScope } from "../../middleware/auth";
import * as dokumenService from "./service";

export const listDokumen = async (req: AuthRequest, res: Response) => {
  const { rows, skip, orderKey, orderRule, searchFilters, filters } = parsePagination(req);
  const pesertaMagangId = typeof filters.pesertaMagangId === "string" ? filters.pesertaMagangId : undefined;

  const result = await dokumenService.listDokumen(
    { skip, rows, orderKey, orderRule, searchFilters },
    pesertaMagangId,
    pembimbingScope(req)
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  paginated(res, result.data.entries, result.data.totalData, result.data.totalPage);
};

export const getDokumenDetail = async (req: AuthRequest, res: Response) => {
  const result = await dokumenService.getDokumenDetail(req.params.id as string, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const createDokumen = async (req: AuthRequest, res: Response) => {
  const { pesertaMagangId, jenisDokumen, namaFile, urlFile } = req.body as {
    pesertaMagangId?: string; jenisDokumen?: string; namaFile?: string; urlFile?: string;
  };

  if (!pesertaMagangId || !jenisDokumen || !namaFile || !urlFile) {
    fail(res, "Peserta magang, jenis dokumen, nama file, dan url file wajib diisi"); return;
  }

  if (!Object.values(JenisDokumen).includes(jenisDokumen as JenisDokumen)) {
    fail(res, `Jenis dokumen tidak valid. Pilihan: ${Object.values(JenisDokumen).join(", ")}`); return;
  }

  const result = await dokumenService.createDokumen(
    { pesertaMagangId, jenisDokumen, namaFile, urlFile },
    pembimbingScope(req)
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Dokumen berhasil ditambahkan");
};

export const deleteDokumen = async (req: AuthRequest, res: Response) => {
  const result = await dokumenService.deleteDokumen(req.params.id as string, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, null, "Dokumen berhasil dihapus");
};

export const authorizeFile = async (req: AuthRequest, res: Response) => {
  const { path } = req.body as { path?: string };

  if (!path) {
    fail(res, "Path file wajib diisi");
    return;
  }

  const result = await dokumenService.authorizeFilePath(path, pembimbingScope(req));
  if (!result.ok) {
    fail(res, result.message, null, result.status);
    return;
  }

  ok(res, result.data);
};
