import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import { parseDateOnly } from "../../lib/datetime";
import { PaginationParams } from "../../lib/pagination";
import { success, failure } from "../../lib/serviceResult";

const jurnalSelect = {
  id: true,
  pesertaMagangId: true,
  tanggal: true,
  kegiatan: true,
  createdAt: true,
  updatedAt: true,
  pesertaMagang: { select: { name: true, divisi: { select: { name: true } } } },
} satisfies Prisma.JurnalSelect;

type JurnalWithRelations = Prisma.JurnalGetPayload<{ select: typeof jurnalSelect }>;

const present = (j: JurnalWithRelations) => ({
  id: j.id,
  pesertaMagangId: j.pesertaMagangId,
  name: j.pesertaMagang.name,
  divisi: j.pesertaMagang.divisi?.name ?? null,
  tanggal: j.tanggal,
  kegiatan: j.kegiatan,
  createdAt: j.createdAt,
  updatedAt: j.updatedAt,
});

// pembimbingId scopes every read/write to that supervisor's binaan; undefined
// means unrestricted (Admin). See pembimbingScope() in middleware/auth.
export const listJurnal = async (
  { skip, rows, orderKey, orderRule, searchFilters }: PaginationParams,
  pesertaMagangId?: string,
  pembimbingId?: string
) => {
  const searchWhere = Object.keys(searchFilters).length
    ? {
        OR: Object.entries(searchFilters).map(([, value]) => ({
          pesertaMagang: { name: { contains: value, mode: "insensitive" as const } },
        })),
      }
    : {};

  const where = {
    ...searchWhere,
    ...(pesertaMagangId ? { pesertaMagangId } : {}),
    ...(pembimbingId ? { pesertaMagang: { pembimbingLapanganId: pembimbingId } } : {}),
  };

  const [data, totalData] = await Promise.all([
    prisma.jurnal.findMany({
      where,
      select: jurnalSelect,
      skip,
      take: rows,
      orderBy: orderKey === "tanggal" ? { tanggal: orderRule } : { createdAt: orderRule },
    }),
    prisma.jurnal.count({ where }),
  ]);

  return success({ entries: data.map(present), totalData, totalPage: Math.ceil(totalData / rows) });
};

// findFirst (not findUnique) so the pembimbing scope rides along in the same
// query — an out-of-scope record reads as "tidak ditemukan".
const findScoped = (id: string, pembimbingId?: string) =>
  prisma.jurnal.findFirst({
    where: {
      id,
      ...(pembimbingId ? { pesertaMagang: { pembimbingLapanganId: pembimbingId } } : {}),
    },
    select: jurnalSelect,
  });

export const getJurnalDetail = async (id: string, pembimbingId?: string) => {
  const jurnal = await findScoped(id, pembimbingId);
  if (!jurnal) return failure("Jurnal tidak ditemukan", 404);
  return success(present(jurnal));
};

interface JurnalInput {
  pesertaMagangId: string;
  tanggal: string;
  kegiatan: string;
}

export const createJurnal = async (input: JurnalInput, pembimbingId?: string) => {
  const pesertaExists = await prisma.pesertaMagang.findFirst({
    where: {
      id: input.pesertaMagangId,
      ...(pembimbingId ? { pembimbingLapanganId: pembimbingId } : {}),
    },
  });
  if (!pesertaExists) return failure("Peserta magang tidak ditemukan", 404);

  const jurnal = await prisma.jurnal.create({
    data: {
      pesertaMagangId: input.pesertaMagangId,
      tanggal: parseDateOnly(input.tanggal),
      kegiatan: input.kegiatan,
    },
    select: jurnalSelect,
  });
  return success(present(jurnal));
};

export const updateJurnal = async (
  id: string,
  input: { tanggal?: string; kegiatan?: string },
  pembimbingId?: string
) => {
  const exists = await findScoped(id, pembimbingId);
  if (!exists) return failure("Jurnal tidak ditemukan", 404);

  const jurnal = await prisma.jurnal.update({
    where: { id },
    data: {
      ...(input.tanggal && { tanggal: parseDateOnly(input.tanggal) }),
      ...(input.kegiatan !== undefined && { kegiatan: input.kegiatan }),
    },
    select: jurnalSelect,
  });
  return success(present(jurnal));
};

export const deleteJurnal = async (id: string, pembimbingId?: string) => {
  const exists = await findScoped(id, pembimbingId);
  if (!exists) return failure("Jurnal tidak ditemukan", 404);

  await prisma.jurnal.delete({ where: { id } });
  return success(null);
};
