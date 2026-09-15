import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import { PaginationParams } from "../../lib/pagination";
import { success, failure } from "../../lib/serviceResult";

const penilaianSelect = {
  id: true,
  pesertaMagangId: true,
  nilai: true,
  komentar: true,
  createdAt: true,
  updatedAt: true,
  pesertaMagang: { select: { name: true, divisi: { select: { name: true } } } },
  penilai: { select: { fullName: true } },
} satisfies Prisma.PenilaianSelect;

type PenilaianWithRelations = Prisma.PenilaianGetPayload<{ select: typeof penilaianSelect }>;

const present = (p: PenilaianWithRelations) => ({
  id: p.id,
  pesertaMagangId: p.pesertaMagangId,
  name: p.pesertaMagang.name,
  divisi: p.pesertaMagang.divisi?.name ?? null,
  penilai: p.penilai.fullName,
  nilai: p.nilai,
  komentar: p.komentar,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
});

// pembimbingId scopes every read/write to that supervisor's binaan; undefined
// means unrestricted (Admin). See pembimbingScope() in middleware/auth.
export const listPenilaian = async (
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

  const where: Prisma.PenilaianWhereInput = {
    AND: [
      searchWhere,
      filters.pesertaMagangId ? { pesertaMagangId: filters.pesertaMagangId } : {},
      Object.keys(pesertaMagangFilter).length ? { pesertaMagang: pesertaMagangFilter } : {},
    ],
  };

  const [data, totalData] = await Promise.all([
    prisma.penilaian.findMany({
      where,
      select: penilaianSelect,
      skip,
      take: rows,
      orderBy: { [orderKey === "nilai" ? "nilai" : "createdAt"]: orderRule },
    }),
    prisma.penilaian.count({ where }),
  ]);

  return success({ entries: data.map(present), totalData, totalPage: Math.ceil(totalData / rows) });
};

// findFirst (not findUnique) so the pembimbing scope rides along in the same
// query — an out-of-scope record reads as "tidak ditemukan".
const findScoped = (id: string, pembimbingId?: string) =>
  prisma.penilaian.findFirst({
    where: {
      id,
      ...(pembimbingId ? { pesertaMagang: { pembimbingLapanganId: pembimbingId } } : {}),
    },
    select: penilaianSelect,
  });

export const getPenilaianDetail = async (id: string, pembimbingId?: string) => {
  const penilaian = await findScoped(id, pembimbingId);
  if (!penilaian) return failure("Penilaian tidak ditemukan", 404);
  return success(present(penilaian));
};

interface PenilaianInput {
  pesertaMagangId: string;
  penilaiId: string;
  nilai: number;
  komentar?: string;
}

export const createPenilaian = async (input: PenilaianInput, pembimbingId?: string) => {
  const pesertaExists = await prisma.pesertaMagang.findFirst({
    where: {
      id: input.pesertaMagangId,
      ...(pembimbingId ? { pembimbingLapanganId: pembimbingId } : {}),
    },
  });
  if (!pesertaExists) return failure("Peserta magang tidak ditemukan", 404);

  if (input.nilai < 0 || input.nilai > 100) return failure("Nilai harus di antara 0 dan 100");

  const penilaian = await prisma.penilaian.create({
    data: {
      pesertaMagangId: input.pesertaMagangId,
      penilaiId: input.penilaiId,
      nilai: input.nilai,
      komentar: input.komentar,
    },
    select: penilaianSelect,
  });
  return success(present(penilaian));
};

export const updatePenilaian = async (
  id: string,
  input: { nilai?: number; komentar?: string },
  pembimbingId?: string
) => {
  const exists = await findScoped(id, pembimbingId);
  if (!exists) return failure("Penilaian tidak ditemukan", 404);

  if (input.nilai !== undefined && (input.nilai < 0 || input.nilai > 100)) {
    return failure("Nilai harus di antara 0 dan 100");
  }

  const penilaian = await prisma.penilaian.update({
    where: { id },
    data: {
      ...(input.nilai !== undefined && { nilai: input.nilai }),
      ...(input.komentar !== undefined && { komentar: input.komentar }),
    },
    select: penilaianSelect,
  });
  return success(present(penilaian));
};

export const deletePenilaian = async (id: string, pembimbingId?: string) => {
  const exists = await findScoped(id, pembimbingId);
  if (!exists) return failure("Penilaian tidak ditemukan", 404);

  await prisma.penilaian.delete({ where: { id } });
  return success(null);
};
