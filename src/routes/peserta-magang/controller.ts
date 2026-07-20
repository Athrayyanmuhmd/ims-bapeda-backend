import { StatusMagang } from "@prisma/client";
import { Response } from "express";
import { ok, paginated, fail } from "../../lib/response";
import { parsePagination } from "../../lib/pagination";
import { AuthRequest } from "../../middleware/auth";
import * as pesertaService from "./service";

interface PesertaBody {
  name?: string;
  email?: string;
  phoneNumber?: string;
  nim?: string;
  divisiId?: string;
  instansiId?: string;
  pembimbingLapanganId?: string;
  tanggalMulai?: string;
  tanggalSelesai?: string;
  status?: string;
}

export const listPeserta = async (req: AuthRequest, res: Response) => {
  const { rows, skip, orderKey, orderRule, searchFilters } = parsePagination(req);

  const result = await pesertaService.listPeserta({ skip, rows, orderKey, orderRule, searchFilters });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  paginated(res, result.data.entries, result.data.totalData, result.data.totalPage);
};

export const getPesertaDetail = async (req: AuthRequest, res: Response) => {
  const result = await pesertaService.getPesertaDetail(req.params.id as string);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const createPeserta = async (req: AuthRequest, res: Response) => {
  const body = req.body as PesertaBody;

  if (!body.name || !body.email) { fail(res, "Nama dan email wajib diisi"); return; }
  if (body.status && !Object.values(StatusMagang).includes(body.status as StatusMagang)) {
    fail(res, `Status tidak valid. Pilihan: ${Object.values(StatusMagang).join(", ")}`); return;
  }

  const result = await pesertaService.createPeserta({
    name: body.name,
    email: body.email,
    phoneNumber: body.phoneNumber,
    nim: body.nim,
    divisiId: body.divisiId,
    instansiId: body.instansiId,
    pembimbingLapanganId: body.pembimbingLapanganId,
    tanggalMulai: body.tanggalMulai,
    tanggalSelesai: body.tanggalSelesai,
    status: body.status,
  });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Peserta magang berhasil dibuat");
};

export const updatePeserta = async (req: AuthRequest, res: Response) => {
  const body = req.body as PesertaBody;

  if (body.status && !Object.values(StatusMagang).includes(body.status as StatusMagang)) {
    fail(res, `Status tidak valid. Pilihan: ${Object.values(StatusMagang).join(", ")}`); return;
  }

  const result = await pesertaService.updatePeserta(req.params.id as string, {
    name: body.name,
    email: body.email,
    phoneNumber: body.phoneNumber,
    nim: body.nim,
    divisiId: body.divisiId,
    instansiId: body.instansiId,
    pembimbingLapanganId: body.pembimbingLapanganId,
    tanggalMulai: body.tanggalMulai,
    tanggalSelesai: body.tanggalSelesai,
    status: body.status,
  });
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Peserta magang berhasil diupdate");
};

export const deletePeserta = async (req: AuthRequest, res: Response) => {
  const result = await pesertaService.deletePeserta(req.params.id as string);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, null, "Peserta magang berhasil dihapus");
};
