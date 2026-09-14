import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  checkInWindowLabel,
  CHECKIN_END,
  CHECKIN_START,
  CHECKOUT_AUTO_AT,
  dayRange,
  isWithinCheckInWindow,
  nowJam,
  parseDateOnly,
  parseWallClock,
  todayIsoDate,
} from "../../lib/datetime";
import { applyAutoCheckout, applyAutoCheckoutMany } from "../../lib/autoCheckout";
import {
  isWorkingDay,
  loadIndonesiaHolidays,
  countWorkingDaysInclusive,
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
  const mulai = p.tanggalMulai ? p.tanggalMulai.toISOString().slice(0, 10) : null;
  const holidays = await loadIndonesiaHolidays();

  const totalHariKerja =
    mulai && selesai ? countWorkingDaysInclusive(mulai, selesai, holidays) : null;
  const totalHariKalender =
    mulai && selesai
      ? Math.max(
          0,
          Math.round(
            (Date.parse(`${selesai}T00:00:00.000Z`) - Date.parse(`${mulai}T00:00:00.000Z`)) /
              (24 * 60 * 60 * 1000)
          ) + 1
        )
      : null;

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
    totalHariKerja,
    totalHariKalender,
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
  izinStatus: true,
  izinJenis: true,
};

export const listOwnAbsensi = async (pesertaMagangId: string, rows: number) => {
  const entries = await prisma.absensi.findMany({
    where: { pesertaMagangId },
    select: absensiSelect,
    orderBy: { tanggal: "desc" },
    take: rows,
  });

  return success(await applyAutoCheckoutMany(entries, absensiSelect));
};

export const getTodayAbsensi = async (pesertaMagangId: string) => {
  const absensi = await prisma.absensi.findFirst({
    where: { pesertaMagangId, tanggal: dayRange(todayIsoDate()) },
    select: absensiSelect,
  });

  if (!absensi) return success(null);
  return success(await applyAutoCheckout(absensi, absensiSelect));
};

// Check-in/check-out are restricted to today on purpose: letting a peserta
// backfill their own attendance would make the record worthless. Correcting a
// past day stays a staff action.
export const checkIn = async (pesertaMagangId: string, jam?: string) => {
  const today = todayIsoDate();
  const holidays = await loadIndonesiaHolidays();

  if (!isWorkingDay(today, holidays)) {
    return failure("Check-in hanya pada hari kerja (Senin–Jumat, kecuali hari libur)");
  }

  if (!isWithinCheckInWindow(jam ?? nowJam())) {
    return failure(`Check-in hanya dibuka pukul ${checkInWindowLabel()}`);
  }

  const existing = await prisma.absensi.findFirst({
    where: { pesertaMagangId, tanggal: dayRange(today) },
    select: { id: true, jamMasuk: true, kehadiran: true, izinStatus: true },
  });

  if (existing?.izinStatus === "PENDING") {
    return failure("Pengajuan izin/sakit Anda masih menunggu persetujuan pembimbing");
  }

  if (
    (existing?.kehadiran === "Izin" || existing?.kehadiran === "Sakit") &&
    existing.izinStatus !== "REJECTED"
  ) {
    return failure("Anda sudah mengajukan izin/sakit hari ini");
  }

  if (existing?.jamMasuk) return failure("Anda sudah melakukan check-in hari ini");

  const jamMasuk = parseWallClock(`${today}T${jam ?? nowJam()}:00`);

  if (existing) {
    const updated = await prisma.absensi.update({
      where: { id: existing.id },
      data: {
        kehadiran: "Hadir",
        jamMasuk,
        izinStatus: null,
        izinJenis: null,
        reviewedById: null,
        reviewedAt: null,
      },
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
    select: absensiSelect,
  });

  if (!existing) return failure("Anda belum check-in hari ini");

  // Past CHECKOUT_AUTO_AT, fill jamKeluar=17:00 before refusing a second checkout.
  const closed = await applyAutoCheckout(existing, absensiSelect);

  if (closed.izinStatus === "PENDING") {
    return failure("Pengajuan izin/sakit masih menunggu persetujuan");
  }

  if (
    (closed.kehadiran === "Izin" || closed.kehadiran === "Sakit") &&
    closed.izinStatus !== "REJECTED"
  ) {
    return failure("Tidak ada check-out untuk hari izin/sakit");
  }

  if (!closed.jamMasuk) return failure("Anda belum check-in hari ini");
  if (closed.jamKeluar) return failure("Anda sudah melakukan check-out hari ini");

  const updated = await prisma.absensi.update({
    where: { id: closed.id },
    data: { jamKeluar: parseWallClock(`${today}T${jam ?? nowJam()}:00`) },
    select: absensiSelect,
  });

  return success(updated);
};

export const PORTAL_IZIN_OPTIONS = ["Izin", "Sakit"] as const;
export type PortalIzinJenis = (typeof PORTAL_IZIN_OPTIONS)[number];

// Self-reported absence for today. Creates a PENDING request — pembimbing must
// approve before it counts as final Izin/Sakit in rekap. Blocks check-in while pending.
export const reportIzin = async (
  pesertaMagangId: string,
  jenis: PortalIzinJenis,
  keterangan?: string
) => {
  if (!PORTAL_IZIN_OPTIONS.includes(jenis)) {
    return failure(`Jenis tidak valid. Pilihan: ${PORTAL_IZIN_OPTIONS.join(", ")}`);
  }

  const note = keterangan?.trim() ?? "";
  if (note.length > 500) return failure("Keterangan maksimal 500 karakter");

  const today = todayIsoDate();
  const existing = await prisma.absensi.findFirst({
    where: { pesertaMagangId, tanggal: dayRange(today) },
    select: { id: true, jamMasuk: true, kehadiran: true, izinStatus: true },
  });

  if (existing?.jamMasuk || existing?.kehadiran === "Hadir") {
    return failure("Sudah check-in hari ini; hubungi pembimbing untuk koreksi");
  }

  if (existing?.izinStatus === "PENDING") {
    return failure("Pengajuan izin/sakit Anda masih menunggu persetujuan");
  }

  if (
    (existing?.kehadiran === "Izin" || existing?.kehadiran === "Sakit") &&
    existing.izinStatus !== "REJECTED"
  ) {
    return failure("Anda sudah mengajukan izin/sakit hari ini");
  }

  const data = {
    kehadiran: jenis,
    izinStatus: "PENDING" as const,
    izinJenis: jenis,
    keterangan: note || null,
    jamMasuk: null,
    jamKeluar: null,
    reviewedById: null,
    reviewedAt: null,
  };

  if (existing) {
    const updated = await prisma.absensi.update({
      where: { id: existing.id },
      data,
      select: absensiSelect,
    });
    return success(updated);
  }

  try {
    const created = await prisma.absensi.create({
      data: {
        pesertaMagangId,
        tanggal: parseDateOnly(today),
        ...data,
      },
      select: absensiSelect,
    });
    return success(created);
  } catch (error) {
    if (isUniqueViolation(error)) return failure("Anda sudah mengajukan izin/sakit hari ini");
    throw error;
  }
};

export const getCheckInWindow = () =>
  success({
    start: CHECKIN_START,
    end: CHECKIN_END,
    label: checkInWindowLabel(),
    isOpen: isWithinCheckInWindow(),
    now: nowJam(),
    autoCheckoutAt: CHECKOUT_AUTO_AT,
  });

/* ---------------- logbook ---------------- */

const logbookSelect = { id: true, tanggal: true, kegiatan: true, createdAt: true };

export const listOwnLogbook = async (pesertaMagangId: string, rows: number) => {
  const entries = await prisma.logbook.findMany({
    where: { pesertaMagangId },
    select: logbookSelect,
    orderBy: { tanggal: "desc" },
    take: rows,
  });

  return success(entries);
};

export const createOwnLogbook = async (
  pesertaMagangId: string,
  tanggal: string,
  kegiatan: string
) => {
  // No future-dated entries — a logbook is a record of work already done.
  // Past days stay writable forever so a forgotten entry can still be filed,
  // but only on days the peserta was actually Hadir (not Izin/Sakit/Alpa/blank).
  if (tanggal > todayIsoDate()) {
    return failure("Tidak bisa menulis logbook untuk tanggal yang belum terjadi");
  }

  const absensi = await prisma.absensi.findFirst({
    where: { pesertaMagangId, tanggal: dayRange(tanggal) },
    select: { kehadiran: true, izinStatus: true, jamMasuk: true },
  });

  if (!absensi || absensi.izinStatus === "PENDING") {
    return failure("Logbook hanya untuk hari Hadir. Absensi tanggal ini belum tercatat sebagai Hadir");
  }

  if (absensi.kehadiran !== "Hadir" || !absensi.jamMasuk) {
    return failure("Logbook tidak bisa diisi pada hari Izin, Sakit, atau Alpa");
  }

  try {
    const logbook = await prisma.logbook.create({
      data: { pesertaMagangId, tanggal: parseDateOnly(tanggal), kegiatan },
      select: logbookSelect,
    });
    return success(logbook);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure("Logbook untuk tanggal ini sudah ada — silakan edit entri yang ada", 409);
    }
    throw error;
  }
};

export const updateOwnLogbook = async (
  pesertaMagangId: string,
  id: string,
  kegiatan: string
) => {
  // Scoped findFirst, not findUnique: an id belonging to someone else must read
  // as "not found" rather than being editable.
  const existing = await prisma.logbook.findFirst({
    where: { id, pesertaMagangId },
    select: { id: true },
  });

  if (!existing) return failure("Logbook tidak ditemukan", 404);

  const logbook = await prisma.logbook.update({
    where: { id },
    data: { kegiatan },
    select: logbookSelect,
  });

  return success(logbook);
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
