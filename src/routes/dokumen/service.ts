import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import { PaginationParams } from "../../lib/pagination";
import { success, failure } from "../../lib/serviceResult";

const dokumenSelect = {
  id: true,
  pesertaMagangId: true,
  jenisDokumen: true,
  namaFile: true,
  urlFile: true,
  createdAt: true,
  updatedAt: true,
  pesertaMagang: { select: { name: true } },
} satisfies Prisma.DokumenSelect;

type DokumenWithRelations = Prisma.DokumenGetPayload<{ select: typeof dokumenSelect }>;

const present = (d: DokumenWithRelations) => ({
  id: d.id,
  pesertaMagangId: d.pesertaMagangId,
  name: d.pesertaMagang.name,
  jenisDokumen: d.jenisDokumen,
  namaFile: d.namaFile,
  urlFile: d.urlFile,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

export const listDokumen = async (
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
    prisma.dokumen.findMany({
      where,
      select: dokumenSelect,
      skip,
      take: rows,
      orderBy: { createdAt: orderRule },
    }),
    prisma.dokumen.count({ where }),
  ]);

  return success({ entries: data.map(present), totalData, totalPage: Math.ceil(totalData / rows) });
};

export const getDokumenDetail = async (id: string) => {
  const dokumen = await prisma.dokumen.findUnique({ where: { id }, select: dokumenSelect });
  if (!dokumen) return failure("Dokumen tidak ditemukan", 404);
  return success(present(dokumen));
};

interface DokumenInput {
  pesertaMagangId: string;
  jenisDokumen: string;
  namaFile: string;
  urlFile: string;
}

export const createDokumen = async (input: DokumenInput) => {
  const pesertaExists = await prisma.pesertaMagang.findUnique({ where: { id: input.pesertaMagangId } });
  if (!pesertaExists) return failure("Peserta magang tidak ditemukan", 404);

  const dokumen = await prisma.dokumen.create({
    data: {
      pesertaMagangId: input.pesertaMagangId,
      jenisDokumen: input.jenisDokumen as Prisma.DokumenCreateInput["jenisDokumen"],
      namaFile: input.namaFile,
      urlFile: input.urlFile,
    },
    select: dokumenSelect,
  });
  return success(present(dokumen));
};

export const deleteDokumen = async (id: string) => {
  const exists = await prisma.dokumen.findUnique({ where: { id } });
  if (!exists) return failure("Dokumen tidak ditemukan", 404);

  await prisma.dokumen.delete({ where: { id } });
  return success(null);
};
