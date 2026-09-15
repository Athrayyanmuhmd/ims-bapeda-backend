import { StatusMagang } from "@prisma/client";
import { Response } from "express";
import { ok, paginated, fail } from "../../lib/response";
import { parsePagination } from "../../lib/pagination";
import { isValidEmail, isValidPhoneId } from "../../lib/validate";
import { AuthRequest, pembimbingScope } from "../../middleware/auth";
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
  portalPassword?: string | null;
}

const validateContactFields = (body: PesertaBody): string | null => {
  if (body.email !== undefined && body.email !== "" && !isValidEmail(body.email)) {
    return "Format email tidak valid";
  }

  if (body.phoneNumber && !isValidPhoneId(body.phoneNumber)) {
    return "Format nomor HP tidak valid (contoh: 081234567890)";
  }

  return null;
};

export const listPeserta = async (req: AuthRequest, res: Response) => {
  const { rows, skip, orderKey, orderRule, searchFilters, filters } = parsePagination(req);
  const asString = (value: unknown) => (typeof value === "string" && value ? value : undefined);

  const result = await pesertaService.listPeserta(
    { skip, rows, orderKey, orderRule, searchFilters },
    {
      divisiId: asString(filters.divisiId),
      instansiId: asString(filters.instansiId),
      pembimbingLapanganId: asString(filters.pembimbingLapanganId),
      status: asString(filters.status),
    },
    pembimbingScope(req)
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  paginated(res, result.data.entries, result.data.totalData, result.data.totalPage);
};

export const getPesertaDetail = async (req: AuthRequest, res: Response) => {
  const result = await pesertaService.getPesertaDetail(req.params.id as string, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const createPeserta = async (req: AuthRequest, res: Response) => {
  const body = req.body as PesertaBody;

  if (!body.name || !body.email) { fail(res, "Nama dan email wajib diisi"); return; }
  if (!isValidEmail(body.email)) { fail(res, "Format email tidak valid"); return; }

  const contactError = validateContactFields(body);
  if (contactError) { fail(res, contactError); return; }

  if (body.status && !Object.values(StatusMagang).includes(body.status as StatusMagang)) {
    fail(res, `Status tidak valid. Pilihan: ${Object.values(StatusMagang).join(", ")}`); return;
  }

  if (body.tanggalMulai && body.tanggalSelesai && body.tanggalSelesai < body.tanggalMulai) {
    fail(res, "Tanggal selesai harus setelah atau sama dengan tanggal mulai"); return;
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
    // Empty string from a blank form = leave inactive; only a real password activates.
    portalPassword: body.portalPassword === "" ? undefined : body.portalPassword ?? undefined,
  }, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Peserta magang berhasil dibuat");
};

export const updatePeserta = async (req: AuthRequest, res: Response) => {
  const body = req.body as PesertaBody;

  if (body.status && !Object.values(StatusMagang).includes(body.status as StatusMagang)) {
    fail(res, `Status tidak valid. Pilihan: ${Object.values(StatusMagang).join(", ")}`); return;
  }

  const contactError = validateContactFields(body);
  if (contactError) { fail(res, contactError); return; }

  if (body.tanggalMulai && body.tanggalSelesai && body.tanggalSelesai < body.tanggalMulai) {
    fail(res, "Tanggal selesai harus setelah atau sama dengan tanggal mulai"); return;
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
    // An empty string from a blank form field means "leave the portal account
    // alone"; null is the explicit "revoke access".
    portalPassword: body.portalPassword === "" ? undefined : body.portalPassword,
  }, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Peserta magang berhasil diupdate");
};

export const deletePeserta = async (req: AuthRequest, res: Response) => {
  const result = await pesertaService.deletePeserta(req.params.id as string, pembimbingScope(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, null, "Peserta magang berhasil dihapus");
};
