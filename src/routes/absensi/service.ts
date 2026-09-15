import { IzinStatus, Kehadiran } from "@prisma/client";
import { closeOpenCheckoutsForDate } from "../../lib/autoCheckout";
import { dayRange, endOfDay, parseDateOnly, parseWallClock } from "../../lib/datetime";
import { PaginationParams } from "../../lib/pagination";
import { isUniqueViolation } from "../../lib/prisma";
import { success, failure } from "../../lib/serviceResult";
import type { Prisma } from "@prisma/client";
import * as absensiRepository from "./repository";

type AbsensiWithRelations = Awaited<ReturnType<typeof absensiRepository.findById>>;

const present = (a: NonNullable<AbsensiWithRelations>) => ({
  id: a.id,
  name: a.pesertaMagang.name,
  pesertaMagangId: a.pesertaMagang.id,
  divisi: a.pesertaMagang.divisi?.name ?? null,
  pembimbingLapangan: a.pesertaMagang.pembimbingLapangan?.fullName ?? null,
  kehadiran: a.kehadiran,
  tanggal: a.tanggal,
  jamMasuk: a.jamMasuk,
  jamKeluar: a.jamKeluar,
  keterangan: a.keterangan,
  izinStatus: a.izinStatus,
  izinJenis: a.izinJenis,
  reviewedBy: a.reviewedBy?.fullName ?? null,
  reviewedAt: a.reviewedAt,
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
});

interface ListAbsensiFilters {
  tanggal?: string;
  dariTanggal?: string;
  sampaiTanggal?: string;
  pesertaMagangId?: string;
  izinStatus?: IzinStatus;
  kehadiran?: Kehadiran;
  divisiId?: string;
  instansiId?: string;
  pembimbingLapanganId?: string;
}

// An exact `tanggal` wins over a range; otherwise either end of the range is
// optional (open-ended "sejak" or "sampai" both make sense for a rekap).
const buildTanggalWhere = ({ tanggal, dariTanggal, sampaiTanggal }: ListAbsensiFilters) => {
  if (tanggal) return { tanggal: dayRange(tanggal) };

  if (!dariTanggal && !sampaiTanggal) return {};

  return {
    tanggal: {
      ...(dariTanggal ? { gte: parseDateOnly(dariTanggal) } : {}),
      ...(sampaiTanggal ? { lte: endOfDay(sampaiTanggal) } : {}),
    },
  };
};

// pembimbingId scopes every read/write to that supervisor's binaan; undefined
// means unrestricted (Admin). See pembimbingScope() in middleware/auth.
export const listAbsensi = async (
  { skip, rows, orderKey, orderRule, searchFilters }: PaginationParams,
  filters: ListAbsensiFilters = {},
  pembimbingId?: string
) => {
  const searchWhere: Prisma.AbsensiWhereInput = Object.keys(searchFilters).length
    ? {
        OR: Object.entries(searchFilters).map(([, value]) => ({
          pesertaMagang: { name: { contains: String(value), mode: "insensitive" as const } },
        })),
      }
    : {};

  const pesertaMagangFilter: Prisma.PesertaMagangWhereInput = {
    ...(pembimbingId
      ? { pembimbingLapanganId: pembimbingId }
      : filters.pembimbingLapanganId
        ? { pembimbingLapanganId: filters.pembimbingLapanganId }
        : {}),
    ...(filters.divisiId ? { divisiId: filters.divisiId } : {}),
    ...(filters.instansiId ? { instansiId: filters.instansiId } : {}),
  };

  const where: Prisma.AbsensiWhereInput = {
    AND: [
      searchWhere,
      buildTanggalWhere(filters),
      filters.pesertaMagangId ? { pesertaMagangId: filters.pesertaMagangId } : {},
      filters.izinStatus ? { izinStatus: filters.izinStatus } : {},
      filters.kehadiran ? { kehadiran: filters.kehadiran } : {},
      Object.keys(pesertaMagangFilter).length ? { pesertaMagang: pesertaMagangFilter } : {},
    ],
  };

  // Stamp missing jamKeluar=17:00 before the roster/rekap is read, so open
  // Hadir rows don't look unfinished after office hours.
  if (filters.tanggal) {
    await closeOpenCheckoutsForDate(filters.tanggal);
  }

  const [data, totalData] = await Promise.all([
    absensiRepository.findMany(where, skip, rows, orderKey === "tanggal" ? { tanggal: orderRule } : { createdAt: orderRule }),
    absensiRepository.count(where),
  ]);

  return success({ entries: data.map(present), totalData, totalPage: Math.ceil(totalData / rows) });
};

export const listPendingIzin = async (pembimbingId?: string) => {
  const where = {
    izinStatus: IzinStatus.PENDING,
    ...(pembimbingId ? { pesertaMagang: { pembimbingLapanganId: pembimbingId } } : {}),
  };

  const data = await absensiRepository.findMany(where, 0, 100, { tanggal: "desc" as const });
  return success(data.map(present));
};

export const getAbsensiDetail = async (id: string, pembimbingId?: string) => {
  const absensi = await absensiRepository.findById(id, pembimbingId);
  if (!absensi) return failure("Absensi tidak ditemukan", 404);
  return success(present(absensi));
};

interface CreateAbsensiInput {
  pesertaMagangId: string;
  kehadiran: Kehadiran;
  tanggal: string;
  jamMasuk?: string;
  jamKeluar?: string;
  keterangan?: string;
}

export const createAbsensi = async (input: CreateAbsensiInput, pembimbingId?: string) => {
  const pesertaExists = await absensiRepository.pesertaExists(input.pesertaMagangId, pembimbingId);
  if (!pesertaExists) return failure("Peserta magang tidak ditemukan", 404);

  try {
    const absensi = await absensiRepository.create({
      pesertaMagangId: input.pesertaMagangId,
      kehadiran: input.kehadiran,
      tanggal: parseDateOnly(input.tanggal),
      jamMasuk: input.jamMasuk ? parseWallClock(input.jamMasuk) : null,
      jamKeluar: input.jamKeluar ? parseWallClock(input.jamKeluar) : null,
      keterangan: input.keterangan,
    });
    return success(present(absensi));
  } catch (error) {
    // @@unique([pesertaMagangId, tanggal]) — tell the operator to edit the
    // existing row rather than surfacing a 500.
    if (isUniqueViolation(error)) {
      return failure("Absensi peserta ini pada tanggal tersebut sudah tercatat", 409);
    }
    throw error;
  }
};

interface UpdateAbsensiInput {
  kehadiran?: Kehadiran;
  tanggal?: string;
  jamMasuk?: string;
  jamKeluar?: string;
  keterangan?: string;
}

export const updateAbsensi = async (id: string, input: UpdateAbsensiInput, pembimbingId?: string) => {
  const exists = await absensiRepository.findById(id, pembimbingId);
  if (!exists) return failure("Absensi tidak ditemukan", 404);

  const data: Record<string, unknown> = {};
  if (input.kehadiran) data.kehadiran = input.kehadiran;
  if (input.tanggal) data.tanggal = parseDateOnly(input.tanggal);
  if (input.keterangan !== undefined) data.keterangan = input.keterangan;

  // Staff override closes any portal izin request — the roster mark is final.
  if (input.kehadiran) {
    data.izinStatus = null;
    data.izinJenis = null;
    data.reviewedById = null;
    data.reviewedAt = null;
  }

  // Sakit/Izin/Alpa don't clock in — clear any leftover jam from a previous
  // Hadir mark instead of letting stale times sit next to the new status.
  if (input.kehadiran && input.kehadiran !== Kehadiran.Hadir) {
    data.jamMasuk = null;
    data.jamKeluar = null;
  } else {
    if (input.jamMasuk !== undefined) data.jamMasuk = input.jamMasuk ? parseWallClock(input.jamMasuk) : null;
    if (input.jamKeluar !== undefined) data.jamKeluar = input.jamKeluar ? parseWallClock(input.jamKeluar) : null;
  }

  try {
    const absensi = await absensiRepository.update(
      id,
      data as Prisma.AbsensiUncheckedUpdateInput
    );
    return success(present(absensi));
  } catch (error) {
    // Moving a row onto a date the peserta already has an entry for.
    if (isUniqueViolation(error)) {
      return failure("Absensi peserta ini pada tanggal tersebut sudah tercatat", 409);
    }
    throw error;
  }
};

export const approveIzin = async (id: string, reviewerId: string, pembimbingId?: string) => {
  const existing = await absensiRepository.findById(id, pembimbingId);
  if (!existing) return failure("Absensi tidak ditemukan", 404);
  if (existing.izinStatus !== IzinStatus.PENDING) {
    return failure("Pengajuan izin ini sudah diproses");
  }

  const jenis = existing.izinJenis ?? existing.kehadiran;
  if (jenis !== Kehadiran.Izin && jenis !== Kehadiran.Sakit) {
    return failure("Jenis izin tidak valid");
  }

  const absensi = await absensiRepository.update(id, {
    kehadiran: jenis,
    izinStatus: IzinStatus.APPROVED,
    izinJenis: jenis,
    jamMasuk: null,
    jamKeluar: null,
    reviewedById: reviewerId,
    reviewedAt: new Date(),
  });

  return success(present(absensi));
};

export const rejectIzin = async (
  id: string,
  reviewerId: string,
  pembimbingId?: string,
  catatan?: string
) => {
  const existing = await absensiRepository.findById(id, pembimbingId);
  if (!existing) return failure("Absensi tidak ditemukan", 404);
  if (existing.izinStatus !== IzinStatus.PENDING) {
    return failure("Pengajuan izin ini sudah diproses");
  }

  const note = catatan?.trim();
  const keterangan = note
    ? [existing.keterangan, `Ditolak: ${note}`].filter(Boolean).join(" · ")
    : existing.keterangan
      ? `${existing.keterangan} · Ditolak`
      : "Ditolak pembimbing";

  const absensi = await absensiRepository.update(id, {
    kehadiran: Kehadiran.Alpa,
    izinStatus: IzinStatus.REJECTED,
    jamMasuk: null,
    jamKeluar: null,
    keterangan,
    reviewedById: reviewerId,
    reviewedAt: new Date(),
  });

  return success(present(absensi));
};

export const deleteAbsensi = async (id: string, pembimbingId?: string) => {
  const exists = await absensiRepository.findById(id, pembimbingId);
  if (!exists) return failure("Absensi tidak ditemukan", 404);

  await absensiRepository.remove(id);
  return success(null);
};
