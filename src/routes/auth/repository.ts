import prisma from "../../lib/prisma";

export const userSelect = {
  id: true,
  fullName: true,
  email: true,
  status: true,
  role: { select: { name: true } },
};

export const findByEmailWithRole = (email: string) =>
  prisma.user.findUnique({ where: { email }, include: { role: true } });

export const findByIdBasic = (id: string) => prisma.user.findUnique({ where: { id }, select: userSelect });
