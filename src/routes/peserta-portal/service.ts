import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { dayRange, nowJam, parseDateOnly, parseWallClock, todayIsoDate } from "../../lib/datetime";
import {
  loadIndonesiaHolidays,
  remainingCalendarDays,
  remainingWorkingDays,
} from "../../lib/indonesiaHolidays";
import prisma, { isUniqueViolation } from "../../lib/prisma";
import { success, failure } from "../../lib/serviceResult";
import { PESERTA_TOKEN_TYPE } from "../../middleware/auth";

export const MIN_PASSWORD_LENGTH = 8;

const signPesertaToken = (pesertaMagangId: string) =>
  jwt.sign({ sub: pesertaMagangId, typ: PESERTA_TOKEN_TYPE }, process.env.JWT_SECRET!, {
    expiresIn: "7d",
  });

const profileSelect = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  nim: true,
  tanggalMulai: true,
  tanggalSelesai: true,
  status: true,
  divisi: { select: { name: true } },
  instansi: { select: { nama: true } },
  pembimbingLapangan: { select: { fullName: true } },
};

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  nim: string | null;
  tanggalMulai: Date | null;
  tanggalSelesai: Date | null;
  status: string;
  divisi: { name: string } | null;
  instansi: { nama: string } | null;
  pembimbingLapangan: { fullName: string } | null;
};

const presentProfile = async (p: ProfileRow) => {
  const today = todayIsoDate();
  const selesai = p.tanggalSelesai ? p.tanggalSelesai.toISOString().slice(0, 10) : null;
  const holidays = await loadIndonesiaHolidays();

  return {
    id: p.id,
    name: p.name,
    email: p.email,
    phoneNumber: p.phoneNumber,
    nim: p.nim,
    tanggalMulai: p.tanggalMulai,
    tanggalSelesai: p.tanggalSelesai,
    status: p.status,
    divisi: p.divisi?.name ?? null,
    instansi: p.instansi?.nama ?? null,
    pembimbingLapangan: p.pembimbingLapangan?.fullName ?? null,
    // Calendar days left (includes weekends/holidays). Working days exclude
    // Sat/Sun and Indonesian national + cuti bersama from the holiday feed.
    sisaHariKalender: remainingCalendarDays(today, selesai),
    sisaHariKerja: remainingWorkingDays(today, selesai, holidays),
  };
};

export const login = async (email: string, password: string) => {
  const peserta = await prisma.pesertaMagang.findFirst({
    where: { email },
    select: { id: true, password: true, status: true },
  });

  // Same message whether the email is unknown, the account was never activated,
  // or the password is wrong — none of those should be distinguishable.
  if (!peserta?.password || !(await bcrypt.compare(password, peserta.password))) {
    return failure("Email atau password salah", 401);
  }

  if (peserta.status !== "AKTIF") {
    return failure("Magang Anda sudah tidak aktif", 403);
  }

  const profile = await prisma.pesertaMagang.findUnique({
    where: { id: peserta.id },
    select: profileSelect,
  });

  if (!profile) return failure("Peserta magang tidak ditemukan", 404);

  return success({ peserta: await presentProfile(profile), token: signPesertaToken(peserta.id) });
};

export const getProfile = async (pesertaMagangId: string) => {
  const profile = await prisma.pesertaMagang.findUnique({
    where: { id: pesertaMagangId },
    select: profileSelect,
  });

  if (!profile) return failure("Peserta magang tidak ditemukan", 404);
  return success(await presentProfile(profile));
};

export const changePassword = async (
  pesertaMagangId: string,
  currentPassword: string,
  newPassword: string
) => {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return failure(`Password baru minimal ${MIN_PASSWORD_LENGTH} karakter`);
  }

  if (newPassword === currentPassword) {
    return failure("Password baru harus berbeda dari password saat ini");
  }

  const peserta = await prisma.pesertaMagang.findUnique({
    where: { id: pesertaMagangId },
    select: { password: true },
  });

  if (!peserta?.password || !(await bcrypt.compare(currentPassword, peserta.password))) {
    return failure("Password saat ini salah", 401);
  }

  await prisma.pesertaMagang.update({
    where: { id: pesertaMagangId },
    data: { password: await bcrypt.hash(newPassword, 10) },
  });

  return success(null);
};

/* ---------------- absensi ---------------- */

const absensiSelect = {
  id: true,
  kehadiran: true,
  tanggal: true,
  jamMasuk: true,
  jamKeluar: true,
  keterangan: true,
};

export const listOwnAbsensi = async (pesertaMagangId: string, rows: number) => {
  const entries = await prisma.absensi.findMany({
    where: { pesertaMagangId },
    select: absensiSelect,
    orderBy: { tanggal: "desc" },
    take: rows,
  });

  return success(entries);
};

export const getTodayAbsensi = async (pesertaMagangId: string) => {
  const absensi = await prisma.absensi.findFirst({
    where: { pesertaMagangId, tanggal: dayRange(todayIsoDate()) },
    select: absensiSelect,
  });

  return success(absensi);
};

// Check-in/check-out are restricted to today on purpose: letting a peserta
// backfill their own attendance would make the record worthless. Correcting a
// past day stays a staff action.
export const checkIn = async (pesertaMagangId: string, jam?: string) => {
  const today = todayIsoDate();

  const existing = await prisma.absensi.findFirst({
    where: { pesertaMagangId, tanggal: dayRange(today) },
    select: { id: true, jamMasuk: true },
  });

  if (existing?.jamMasuk) return failure("Anda sudah melakukan check-in hari ini");

  const jamMasuk = parseWallClock(`${today}T${jam ?? nowJam()}:00`);

  if (existing) {
    const updated = await prisma.absensi.update({
      where: { id: existing.id },
      data: { kehadiran: "Hadir", jamMasuk },
      select: absensiSelect,
    });
    return success(updated);
  }

  try {
    const created = await prisma.absensi.create({
      data: { pesertaMagangId, kehadiran: "Hadir", tanggal: parseDateOnly(today), jamMasuk },
      select: absensiSelect,
    });
    return success(created);
  } catch (error) {
    // Two rapid check-ins racing on @@unique([pesertaMagangId, tanggal]).
    if (isUniqueViolation(error)) return failure("Anda sudah melakukan check-in hari ini");
    throw error;
  }
};

export const checkOut = async (pesertaMagangId: string, jam?: string) => {
  const today = todayIsoDate();

  const existing = await prisma.absensi.findFirst({
    where: { pesertaMagangId, tanggal: dayRange(today) },
    select: { id: true, jamMasuk: true, jamKeluar: true },
  });

  if (!existing?.jamMasuk) return failure("Anda belum check-in hari ini");
  if (existing.jamKeluar) return failure("Anda sudah melakukan check-out hari ini");

  const updated = await prisma.absensi.update({
    where: { id: existing.id },
    data: { jamKeluar: parseWallClock(`${today}T${jam ?? nowJam()}:00`) },
    select: absensiSelect,
  });

  return success(updated);
};

/* ---------------- jurnal ---------------- */

const jurnalSelect = { id: true, tanggal: true, kegiatan: true, createdAt: true };

export const listOwnJurnal = async (pesertaMagangId: string, rows: number) => {
  const entries = await prisma.jurnal.findMany({
    where: { pesertaMagangId },
    select: jurnalSelect,
    orderBy: { tanggal: "desc" },
    take: rows,
  });

  return success(entries);
};

export const createOwnJurnal = async (
  pesertaMagangId: string,
  tanggal: string,
  kegiatan: string
) => {
  // No future-dated entries — a jurnal is a record of work already done.
  if (tanggal > todayIsoDate()) {
    return failure("Tidak bisa menulis jurnal untuk tanggal yang belum terjadi");
  }

  const jurnal = await prisma.jurnal.create({
    data: { pesertaMagangId, tanggal: parseDateOnly(tanggal), kegiatan },
    select: jurnalSelect,
  });

  return success(jurnal);
};

export const updateOwnJurnal = async (
  pesertaMagangId: string,
  id: string,
  kegiatan: string
) => {
  // Scoped findFirst, not findUnique: an id belonging to someone else must read
  // as "not found" rather than being editable.
  const existing = await prisma.jurnal.findFirst({
    where: { id, pesertaMagangId },
    select: { id: true },
  });

  if (!existing) return failure("Jurnal tidak ditemukan", 404);

  const jurnal = await prisma.jurnal.update({
    where: { id },
    data: { kegiatan },
    select: jurnalSelect,
  });

  return success(jurnal);
};

/* ---------------- read-only ---------------- */

export const listOwnPenilaian = async (pesertaMagangId: string) => {
  const entries = await prisma.penilaian.findMany({
    where: { pesertaMagangId },
    select: {
      id: true,
      nilai: true,
      komentar: true,
      createdAt: true,
      penilai: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return success(entries.map((p) => ({ ...p, penilai: p.penilai.fullName })));
};

export const listOwnDokumen = async (pesertaMagangId: string) => {
  const entries = await prisma.dokumen.findMany({
    where: { pesertaMagangId },
    select: { id: true, jenisDokumen: true, namaFile: true, urlFile: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return success(entries);
};
