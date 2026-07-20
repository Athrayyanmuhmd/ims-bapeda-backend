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

export const listPenilaian = async (
  { skip, rows, orderKey, orderRule, searchFilters }: PaginationParams,
  pesertaMagangId?: string
) => {
  const searchWhere = Object.keys(searchFilters).length
    ? {
        OR: Object.entries(searchFilters).map(([, value]) => ({
          pesertaMagang: { name: { contains: value, mode: "insensitive" as const } },
        })),
      }
    : {};

  const where = { ...searchWhere, ...(pesertaMagangId ? { pesertaMagangId } : {}) };

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

export const getPenilaianDetail = async (id: string) => {
  const penilaian = await prisma.penilaian.findUnique({ where: { id }, select: penilaianSelect });
  if (!penilaian) return failure("Penilaian tidak ditemukan", 404);
  return success(present(penilaian));
};

interface PenilaianInput {
  pesertaMagangId: string;
  penilaiId: string;
  nilai: number;
  komentar?: string;
}

export const createPenilaian = async (input: PenilaianInput) => {
  const pesertaExists = await prisma.pesertaMagang.findUnique({ where: { id: input.pesertaMagangId } });
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

export const updatePenilaian = async (id: string, input: { nilai?: number; komentar?: string }) => {
  const exists = await prisma.penilaian.findUnique({ where: { id } });
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

export const deletePenilaian = async (id: string) => {
  const exists = await prisma.penilaian.findUnique({ where: { id } });
  if (!exists) return failure("Penilaian tidak ditemukan", 404);

  await prisma.penilaian.delete({ where: { id } });
  return success(null);
};
