import prisma from "../../lib/prisma";
import { buildSearchWhere, PaginationParams } from "../../lib/pagination";
import { success, failure } from "../../lib/serviceResult";

export const listInstansi = async ({ skip, rows, orderKey, orderRule, searchFilters }: PaginationParams) => {
  const where = buildSearchWhere(searchFilters);

  const [instansi, totalData] = await Promise.all([
    prisma.instansi.findMany({ where, skip, take: rows, orderBy: { [orderKey]: orderRule } }),
    prisma.instansi.count({ where }),
  ]);

  return success({ entries: instansi, totalData, totalPage: Math.ceil(totalData / rows) });
};

export const getInstansiDetail = async (id: string) => {
  const instansi = await prisma.instansi.findUnique({ where: { id } });
  if (!instansi) return failure("Instansi tidak ditemukan", 404);
  return success(instansi);
};

interface InstansiInput {
  nama: string;
  jenis: string;
  alamat?: string;
  namaPic?: string;
  noHpPic?: string;
}

export const createInstansi = async (input: InstansiInput) => {
  const instansi = await prisma.instansi.create({ data: input });
  return success(instansi);
};

export const updateInstansi = async (id: string, input: Partial<InstansiInput>) => {
  const exists = await prisma.instansi.findUnique({ where: { id } });
  if (!exists) return failure("Instansi tidak ditemukan", 404);

  const instansi = await prisma.instansi.update({ where: { id }, data: input });
  return success(instansi);
};

export const deleteInstansi = async (id: string) => {
  const exists = await prisma.instansi.findUnique({ where: { id } });
  if (!exists) return failure("Instansi tidak ditemukan", 404);

  await prisma.instansi.delete({ where: { id } });
  return success(null);
};
