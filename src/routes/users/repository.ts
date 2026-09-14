import prisma from "../../lib/prisma";

export const userSelect = {
  id: true,
  fullName: true,
  email: true,
  phoneNumber: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  divisi: { select: { id: true, name: true } },
  role: { select: { id: true, name: true } },
};

export const findMany = (where: object, skip: number, take: number, orderBy: object) =>
  prisma.user.findMany({ where, select: userSelect, skip, take, orderBy });

export const count = (where: object) => prisma.user.count({ where });

export const findById = (id: string) => prisma.user.findUnique({ where: { id }, select: userSelect });

export const findByEmail = (email: string) => prisma.user.findUnique({ where: { email } });

// The only read that returns the hash — for verifying a self-service password
// change. Everything else goes through userSelect, which omits it.
export const findWithPassword = (id: string) =>
  prisma.user.findUnique({ where: { id }, select: { id: true, password: true } });

export const create = (data: {
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  divisiId?: string;
  roleId?: string;
}) => prisma.user.create({ data, select: userSelect });

export const update = (id: string, data: Record<string, unknown>) =>
  prisma.user.update({ where: { id }, data, select: userSelect });

export const remove = (id: string) => prisma.user.delete({ where: { id } });
