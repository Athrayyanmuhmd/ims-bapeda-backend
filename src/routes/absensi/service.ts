import { PaginationParams } from "../../lib/pagination";
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
  pesertaMagangId?: string;
}

export const listAbsensi = async (
  { skip, rows, orderKey, orderRule, searchFilters }: PaginationParams,
  filters: ListAbsensiFilters = {}
) => {
  const searchWhere = Object.keys(searchFilters).length
    ? {
        OR: Object.entries(searchFilters).map(([, value]) => ({
          pesertaMagang: { name: { contains: value, mode: "insensitive" as const } },
        })),
      }
    : {};

  const tanggalWhere = filters.tanggal
    ? { tanggal: { gte: new Date(`${filters.tanggal}T00:00:00`), lt: new Date(`${filters.tanggal}T23:59:59.999`) } }
    : {};

  const pesertaWhere = filters.pesertaMagangId ? { pesertaMagangId: filters.pesertaMagangId } : {};

  const where = { ...searchWhere, ...tanggalWhere, ...pesertaWhere };

  const [data, totalData] = await Promise.all([
    absensiRepository.findMany(where, skip, rows, orderKey === "tanggal" ? { tanggal: orderRule } : { createdAt: orderRule }),
    absensiRepository.count(where),
  ]);

  return success({ entries: data.map(present), totalData, totalPage: Math.ceil(totalData / rows) });
};

export const getAbsensiDetail = async (id: string) => {
  const absensi = await absensiRepository.findById(id);
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

export const createAbsensi = async (input: CreateAbsensiInput) => {
  const pesertaExists = await absensiRepository.pesertaExists(input.pesertaMagangId);
  if (!pesertaExists) return failure("Peserta magang tidak ditemukan", 404);

  const absensi = await absensiRepository.create({
    pesertaMagangId: input.pesertaMagangId,
    kehadiran: input.kehadiran,
    tanggal: new Date(input.tanggal),
    jamMasuk: input.jamMasuk ? new Date(input.jamMasuk) : null,
    jamKeluar: input.jamKeluar ? new Date(input.jamKeluar) : null,
    keterangan: input.keterangan,
  });
  return success(present(absensi));
};

interface UpdateAbsensiInput {
  kehadiran?: string;
  tanggal?: string;
  jamMasuk?: string;
  jamKeluar?: string;
  keterangan?: string;
}

export const updateAbsensi = async (id: string, input: UpdateAbsensiInput) => {
  const exists = await absensiRepository.findById(id);
  if (!exists) return failure("Absensi tidak ditemukan", 404);

  const data: Record<string, unknown> = {};
  if (input.kehadiran) data.kehadiran = input.kehadiran;
  if (input.tanggal) data.tanggal = new Date(input.tanggal);
  if (input.keterangan !== undefined) data.keterangan = input.keterangan;

  // Sakit/Izin/Alpa don't clock in — clear any leftover jam from a previous
  // Hadir mark instead of letting stale times sit next to the new status.
  if (input.kehadiran && input.kehadiran !== "Hadir") {
    data.jamMasuk = null;
    data.jamKeluar = null;
  } else {
    if (input.jamMasuk !== undefined) data.jamMasuk = input.jamMasuk ? new Date(input.jamMasuk) : null;
    if (input.jamKeluar !== undefined) data.jamKeluar = input.jamKeluar ? new Date(input.jamKeluar) : null;
  }

  const absensi = await absensiRepository.update(id, data);
  return success(present(absensi));
};

export const deleteAbsensi = async (id: string) => {
  const exists = await absensiRepository.findById(id);
  if (!exists) return failure("Absensi tidak ditemukan", 404);

  await absensiRepository.remove(id);
  return success(null);
};
