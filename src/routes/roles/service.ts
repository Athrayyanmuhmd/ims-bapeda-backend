import prisma from "../../lib/prisma";
import { buildSearchWhere, PaginationParams } from "../../lib/pagination";
import { success, failure } from "../../lib/serviceResult";

export const listRoles = async ({ skip, rows, orderKey, orderRule, searchFilters }: PaginationParams) => {
  const where = buildSearchWhere(searchFilters);

  const [roles, totalData] = await Promise.all([
    prisma.role.findMany({ where, skip, take: rows, orderBy: { [orderKey]: orderRule } }),
    prisma.role.count({ where }),
  ]);

  return success({ entries: roles, totalData, totalPage: Math.ceil(totalData / rows) });
};

export const getRoleDetail = async (id: string) => {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) return failure("Role tidak ditemukan", 404);
  return success(role);
};

export const createRole = async (name: string, description?: string) => {
  const role = await prisma.role.create({ data: { name, description } });
  return success(role);
};

export const updateRole = async (id: string, name?: string, description?: string) => {
  const exists = await prisma.role.findUnique({ where: { id } });
  if (!exists) return failure("Role tidak ditemukan", 404);

  const role = await prisma.role.update({
    where: { id },
    data: { ...(name && { name }), ...(description !== undefined && { description }) },
  });
  return success(role);
};

export const deleteRole = async (id: string) => {
  const exists = await prisma.role.findUnique({ where: { id } });
  if (!exists) return failure("Role tidak ditemukan", 404);

  await prisma.role.delete({ where: { id } });
  return success(null);
};
