import { Request, Response } from "express";
import { ok, fail } from "../../lib/response";
import { isValidEmail } from "../../lib/validate";
import { PesertaRequest } from "../../middleware/authPeserta";
import * as portalService from "./service";

// Every handler below takes the peserta id from req.pesertaMagangId (set by
// authenticatePeserta from the token) and never from the request body or params,
// so none of these can be pointed at another peserta's data.
const own = (req: PesertaRequest) => req.pesertaMagangId as string;

const clampRows = (raw: unknown) => {
  const parsed = Number.parseInt(typeof raw === "string" ? raw : "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 500) : 100;
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    fail(res, "Email dan password wajib diisi");
    return;
  }

  if (!isValidEmail(email)) {
    fail(res, "Format email tidak valid");
    return;
  }

  const result = await portalService.login(email, password);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Login berhasil");
};

export const getProfile = async (req: PesertaRequest, res: Response) => {
  const result = await portalService.getProfile(own(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const changePassword = async (req: PesertaRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    fail(res, "Password saat ini dan password baru wajib diisi");
    return;
  }

  const result = await portalService.changePassword(own(req), currentPassword, newPassword);
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, null, "Password berhasil diubah");
};

export const listAbsensi = async (req: PesertaRequest, res: Response) => {
  const result = await portalService.listOwnAbsensi(own(req), clampRows(req.query.rows));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const getTodayAbsensi = async (req: PesertaRequest, res: Response) => {
  const result = await portalService.getTodayAbsensi(own(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const checkIn = async (req: PesertaRequest, res: Response) => {
  const result = await portalService.checkIn(own(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data, "Check-in berhasil");
};

export const checkOut = async (req: PesertaRequest, res: Response) => {
  const result = await portalService.checkOut(own(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data, "Check-out berhasil");
};

export const getCheckInWindow = async (_req: PesertaRequest, res: Response) => {
  const result = portalService.getCheckInWindow();
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const reportIzin = async (req: PesertaRequest, res: Response) => {
  const { jenis, keterangan } = req.body as { jenis?: string; keterangan?: string };

  if (!jenis) {
    fail(res, "Jenis izin wajib diisi (Izin atau Sakit)");
    return;
  }

  if (!portalService.PORTAL_IZIN_OPTIONS.includes(jenis as portalService.PortalIzinJenis)) {
    fail(res, `Jenis tidak valid. Pilihan: ${portalService.PORTAL_IZIN_OPTIONS.join(", ")}`);
    return;
  }

  const result = await portalService.reportIzin(
    own(req),
    jenis as portalService.PortalIzinJenis,
    keterangan
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, `${jenis} berhasil diajukan`);
};

export const listLogbook = async (req: PesertaRequest, res: Response) => {
  const result = await portalService.listOwnLogbook(own(req), clampRows(req.query.rows));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const createLogbook = async (req: PesertaRequest, res: Response) => {
  const { tanggal, kegiatan } = req.body as { tanggal?: string; kegiatan?: string };

  if (!tanggal || !kegiatan?.trim()) {
    fail(res, "Tanggal dan kegiatan wajib diisi");
    return;
  }

  const result = await portalService.createOwnLogbook(own(req), tanggal, kegiatan.trim());
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Logbook berhasil disimpan");
};

export const updateLogbook = async (req: PesertaRequest, res: Response) => {
  const { kegiatan } = req.body as { kegiatan?: string };

  if (!kegiatan?.trim()) {
    fail(res, "Kegiatan wajib diisi");
    return;
  }

  const result = await portalService.updateOwnLogbook(
    own(req),
    req.params.id as string,
    kegiatan.trim()
  );
  if (!result.ok) { fail(res, result.message, null, result.status); return; }

  ok(res, result.data, "Logbook berhasil diupdate");
};

export const listPenilaian = async (req: PesertaRequest, res: Response) => {
  const result = await portalService.listOwnPenilaian(own(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};

export const listDokumen = async (req: PesertaRequest, res: Response) => {
  const result = await portalService.listOwnDokumen(own(req));
  if (!result.ok) { fail(res, result.message, null, result.status); return; }
  ok(res, result.data);
};
