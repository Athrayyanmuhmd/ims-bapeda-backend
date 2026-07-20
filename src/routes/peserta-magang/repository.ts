import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";

export const pesertaSelect = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  nim: true,
  tanggalMulai: true,
  tanggalSelesai: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  divisi: { select: { id: true, name: true } },
  instansi: { select: { id: true, nama: true } },
  pembimbingLapangan: { select: { id: true, fullName: true } },
};

export const findMany = (where: object, skip: number, take: number, orderBy: object) =>
  prisma.pesertaMagang.findMany({ where, select: pesertaSelect, skip, take, orderBy });

export const count = (where: object) => prisma.pesertaMagang.count({ where });

export const findById = (id: string) =>
  prisma.pesertaMagang.findUnique({ where: { id }, select: pesertaSelect });

export const create = (data: Prisma.PesertaMagangUncheckedCreateInput) =>
  prisma.pesertaMagang.create({ data, select: pesertaSelect });

export const update = (id: string, data: Record<string, unknown>) =>
  prisma.pesertaMagang.update({ where: { id }, data, select: pesertaSelect });

export const remove = (id: string) => prisma.pesertaMagang.delete({ where: { id } });
