import { dayRange, endOfDay, parseDateOnly, parseWallClock } from "../../lib/datetime";
import { PaginationParams } from "../../lib/pagination";
import { isUniqueViolation } from "../../lib/prisma";
import { success, failure } from "../../lib/serviceResult";
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
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
});

interface ListAbsensiFilters {
  tanggal?: string;
  dariTanggal?: string;
  sampaiTanggal?: string;
  pesertaMagangId?: string;
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
  const searchWhere = Object.keys(searchFilters).length
    ? {
        OR: Object.entries(searchFilters).map(([, value]) => ({
          pesertaMagang: { name: { contains: value, mode: "insensitive" as const } },
        })),
      }
    : {};

  const tanggalWhere = buildTanggalWhere(filters);

  const pesertaWhere = filters.pesertaMagangId ? { pesertaMagangId: filters.pesertaMagangId } : {};

  const scopeWhere = pembimbingId ? { pesertaMagang: { pembimbingLapanganId: pembimbingId } } : {};

  const where = { ...searchWhere, ...tanggalWhere, ...pesertaWhere, ...scopeWhere };

  const [data, totalData] = await Promise.all([
    absensiRepository.findMany(where, skip, rows, orderKey === "tanggal" ? { tanggal: orderRule } : { createdAt: orderRule }),
    absensiRepository.count(where),
  ]);

  return success({ entries: data.map(present), totalData, totalPage: Math.ceil(totalData / rows) });
};

export const getAbsensiDetail = async (id: string, pembimbingId?: string) => {
  const absensi = await absensiRepository.findById(id, pembimbingId);
  if (!absensi) return failure("Absensi tidak ditemukan", 404);
  return success(present(absensi));
};

interface CreateAbsensiInput {
  pesertaMagangId: string;
  kehadiran: string;
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
  kehadiran?: string;
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

  // Sakit/Izin/Alpa don't clock in — clear any leftover jam from a previous
  // Hadir mark instead of letting stale times sit next to the new status.
  if (input.kehadiran && input.kehadiran !== "Hadir") {
    data.jamMasuk = null;
    data.jamKeluar = null;
  } else {
    if (input.jamMasuk !== undefined) data.jamMasuk = input.jamMasuk ? parseWallClock(input.jamMasuk) : null;
    if (input.jamKeluar !== undefined) data.jamKeluar = input.jamKeluar ? parseWallClock(input.jamKeluar) : null;
  }

  try {
    const absensi = await absensiRepository.update(id, data);
    return success(present(absensi));
  } catch (error) {
    // Moving a row onto a date the peserta already has an entry for.
    if (isUniqueViolation(error)) {
      return failure("Absensi peserta ini pada tanggal tersebut sudah tercatat", 409);
    }
    throw error;
  }
};

export const deleteAbsensi = async (id: string, pembimbingId?: string) => {
  const exists = await absensiRepository.findById(id, pembimbingId);
  if (!exists) return failure("Absensi tidak ditemukan", 404);

  await absensiRepository.remove(id);
  return success(null);
};
