import { Prisma } from "@prisma/client";
import prisma, { isUniqueViolation } from "../../lib/prisma";
import { parseDateOnly } from "../../lib/datetime";
import { PaginationParams } from "../../lib/pagination";
import { success, failure } from "../../lib/serviceResult";

const logbookSelect = {
  id: true,
  pesertaMagangId: true,
  tanggal: true,
  kegiatan: true,
  createdAt: true,
  updatedAt: true,
  pesertaMagang: { select: { name: true, divisi: { select: { name: true } } } },
} satisfies Prisma.LogbookSelect;

type LogbookWithRelations = Prisma.LogbookGetPayload<{ select: typeof logbookSelect }>;

const present = (row: LogbookWithRelations) => ({
  id: row.id,
  pesertaMagangId: row.pesertaMagangId,
  name: row.pesertaMagang.name,
  divisi: row.pesertaMagang.divisi?.name ?? null,
  tanggal: row.tanggal,
  kegiatan: row.kegiatan,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

// pembimbingId scopes every read/write to that supervisor's binaan; undefined
// means unrestricted (Admin). See pembimbingScope() in middleware/auth.
export const listLogbook = async (
  { skip, rows, orderKey, orderRule, searchFilters }: PaginationParams,
  filters: {
    pesertaMagangId?: string;
    divisiId?: string;
    instansiId?: string;
    pembimbingLapanganId?: string;
  } = {},
  pembimbingId?: string
) => {
  const searchWhere = Object.keys(searchFilters).length
    ? {
        OR: Object.entries(searchFilters).map(([, value]) => ({
          pesertaMagang: { name: { contains: value, mode: "insensitive" as const } },
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

  const where: Prisma.LogbookWhereInput = {
    AND: [
      searchWhere,
      filters.pesertaMagangId ? { pesertaMagangId: filters.pesertaMagangId } : {},
      Object.keys(pesertaMagangFilter).length ? { pesertaMagang: pesertaMagangFilter } : {},
    ],
  };

  const [data, totalData] = await Promise.all([
    prisma.logbook.findMany({
      where,
      select: logbookSelect,
      skip,
      take: rows,
      orderBy: orderKey === "tanggal" ? { tanggal: orderRule } : { createdAt: orderRule },
    }),
    prisma.logbook.count({ where }),
  ]);

  return success({ entries: data.map(present), totalData, totalPage: Math.ceil(totalData / rows) });
};

// findFirst (not findUnique) so the pembimbing scope rides along in the same
// query — an out-of-scope record reads as "tidak ditemukan".
const findScoped = (id: string, pembimbingId?: string) =>
  prisma.logbook.findFirst({
    where: {
      id,
      ...(pembimbingId ? { pesertaMagang: { pembimbingLapanganId: pembimbingId } } : {}),
    },
    select: logbookSelect,
  });

export const getLogbookDetail = async (id: string, pembimbingId?: string) => {
  const logbook = await findScoped(id, pembimbingId);
  if (!logbook) return failure("Logbook tidak ditemukan", 404);
  return success(present(logbook));
};

interface LogbookInput {
  pesertaMagangId: string;
  tanggal: string;
  kegiatan: string;
}

export const createLogbook = async (input: LogbookInput, pembimbingId?: string) => {
  const pesertaExists = await prisma.pesertaMagang.findFirst({
    where: {
      id: input.pesertaMagangId,
      ...(pembimbingId ? { pembimbingLapanganId: pembimbingId } : {}),
    },
  });
  if (!pesertaExists) return failure("Peserta magang tidak ditemukan", 404);

  try {
    const logbook = await prisma.logbook.create({
      data: {
        pesertaMagangId: input.pesertaMagangId,
        tanggal: parseDateOnly(input.tanggal),
        kegiatan: input.kegiatan,
      },
      select: logbookSelect,
    });
    return success(present(logbook));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure("Logbook peserta ini pada tanggal tersebut sudah tercatat", 409);
    }
    throw error;
  }
};

export const updateLogbook = async (
  id: string,
  input: { tanggal?: string; kegiatan?: string },
  pembimbingId?: string
) => {
  const exists = await findScoped(id, pembimbingId);
  if (!exists) return failure("Logbook tidak ditemukan", 404);

  try {
    const logbook = await prisma.logbook.update({
      where: { id },
      data: {
        ...(input.tanggal && { tanggal: parseDateOnly(input.tanggal) }),
        ...(input.kegiatan !== undefined && { kegiatan: input.kegiatan }),
      },
      select: logbookSelect,
    });
    return success(present(logbook));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return failure("Logbook peserta ini pada tanggal tersebut sudah tercatat", 409);
    }
    throw error;
  }
};

export const deleteLogbook = async (id: string, pembimbingId?: string) => {
  const exists = await findScoped(id, pembimbingId);
  if (!exists) return failure("Logbook tidak ditemukan", 404);

  await prisma.logbook.delete({ where: { id } });
  return success(null);
};
