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

// pembimbingId scopes every read/write to that supervisor's binaan; undefined
// means unrestricted (Admin). See pembimbingScope() in middleware/auth.
export const listDokumen = async (
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

// findFirst (not findUnique) so the pembimbing scope rides along in the same
// query — an out-of-scope record reads as "tidak ditemukan".
const findScoped = (id: string, pembimbingId?: string) =>
  prisma.dokumen.findFirst({
    where: {
      id,
      ...(pembimbingId ? { pesertaMagang: { pembimbingLapanganId: pembimbingId } } : {}),
    },
    select: dokumenSelect,
  });

export const getDokumenDetail = async (id: string, pembimbingId?: string) => {
  const dokumen = await findScoped(id, pembimbingId);
  if (!dokumen) return failure("Dokumen tidak ditemukan", 404);
  return success(present(dokumen));
};

interface DokumenInput {
  pesertaMagangId: string;
  jenisDokumen: string;
  namaFile: string;
  urlFile: string;
}

export const createDokumen = async (input: DokumenInput, pembimbingId?: string) => {
  const pesertaExists = await prisma.pesertaMagang.findFirst({
    where: {
      id: input.pesertaMagangId,
      ...(pembimbingId ? { pembimbingLapanganId: pembimbingId } : {}),
    },
  });
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

export const deleteDokumen = async (id: string, pembimbingId?: string) => {
  const exists = await findScoped(id, pembimbingId);
  if (!exists) return failure("Dokumen tidak ditemukan", 404);

  await prisma.dokumen.delete({ where: { id } });
  return success(null);
};

// Used by the Next.js download broker: confirm the caller's scope includes a
// dokumen whose urlFile points at this storage object, before minting a signed URL.
export const authorizeFilePath = async (path: string, pembimbingId?: string) => {
  if (!path || path.includes("..") || path.startsWith("/")) {
    return failure("Path file tidak valid");
  }

  const dokumen = await prisma.dokumen.findFirst({
    where: {
      OR: [
        { urlFile: { contains: `path=${encodeURIComponent(path)}` } },
        { urlFile: { contains: path } },
      ],
      ...(pembimbingId ? { pesertaMagang: { pembimbingLapanganId: pembimbingId } } : {}),
    },
    select: { id: true },
  });

  if (!dokumen) return failure("Dokumen tidak ditemukan", 404);
  return success({ id: dokumen.id });
};
