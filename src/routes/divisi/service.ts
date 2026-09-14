import prisma from "../../lib/prisma";
import { buildOrderBy, buildSearchWhere, PaginationParams } from "../../lib/pagination";
import { success, failure } from "../../lib/serviceResult";

const SEARCHABLE = ["name", "description"] as const;
const SORTABLE = ["name", "createdAt"] as const;

export const listDivisi = async ({ skip, rows, orderKey, orderRule, searchFilters }: PaginationParams) => {
  const where = buildSearchWhere(searchFilters, SEARCHABLE);

  const [divisi, totalData] = await Promise.all([
    prisma.divisi.findMany({
      where,
      skip,
      take: rows,
      orderBy: buildOrderBy(orderKey, orderRule, SORTABLE),
    }),
    prisma.divisi.count({ where }),
  ]);

  return success({ entries: divisi, totalData, totalPage: Math.ceil(totalData / rows) });
};

export const getDivisiDetail = async (id: string) => {
  const divisi = await prisma.divisi.findUnique({ where: { id } });
  if (!divisi) return failure("Divisi tidak ditemukan", 404);
  return success(divisi);
};

export const createDivisi = async (name: string, description?: string) => {
  const divisi = await prisma.divisi.create({ data: { name, description } });
  return success(divisi);
};

export const updateDivisi = async (id: string, name?: string, description?: string) => {
  const exists = await prisma.divisi.findUnique({ where: { id } });
  if (!exists) return failure("Divisi tidak ditemukan", 404);

  const divisi = await prisma.divisi.update({
    where: { id },
    data: { ...(name && { name }), ...(description !== undefined && { description }) },
  });
  return success(divisi);
};

export const deleteDivisi = async (id: string) => {
  const exists = await prisma.divisi.findUnique({ where: { id } });
  if (!exists) return failure("Divisi tidak ditemukan", 404);

  await prisma.divisi.delete({ where: { id } });
  return success(null);
};
