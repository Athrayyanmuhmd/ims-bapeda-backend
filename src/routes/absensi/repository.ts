import prisma from "../../lib/prisma";

export const absensiSelect = {
  id: true,
  kehadiran: true,
  tanggal: true,
  jamMasuk: true,
  jamKeluar: true,
  keterangan: true,
  createdAt: true,
  updatedAt: true,
  pesertaMagang: {
    select: {
      id: true,
      name: true,
      divisi: { select: { name: true } },
      pembimbingLapangan: { select: { fullName: true } },
    },
  },
};

export const findMany = (where: object, skip: number, take: number, orderBy: object) =>
  prisma.absensi.findMany({ where, select: absensiSelect, skip, take, orderBy });

export const count = (where: object) => prisma.absensi.count({ where });

export const findById = (id: string) =>
  prisma.absensi.findUnique({ where: { id }, select: absensiSelect });

export const pesertaExists = (pesertaMagangId: string) =>
  prisma.pesertaMagang.findUnique({ where: { id: pesertaMagangId } });

export const create = (data: {
  pesertaMagangId: string;
  kehadiran: string;
  tanggal: Date;
  jamMasuk: Date | null;
  jamKeluar: Date | null;
  keterangan?: string;
}) => prisma.absensi.create({ data, select: absensiSelect });

export const update = (id: string, data: Record<string, unknown>) =>
  prisma.absensi.update({ where: { id }, data, select: absensiSelect });

export const remove = (id: string) => prisma.absensi.delete({ where: { id } });
