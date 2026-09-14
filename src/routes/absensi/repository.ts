import { Kehadiran, type IzinStatus, type Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";

export const absensiSelect = {
  id: true,
  kehadiran: true,
  tanggal: true,
  jamMasuk: true,
  jamKeluar: true,
  keterangan: true,
  izinStatus: true,
  izinJenis: true,
  reviewedById: true,
  reviewedAt: true,
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
  reviewedBy: { select: { fullName: true } },
} satisfies Prisma.AbsensiSelect;

export const findMany = (where: object, skip: number, take: number, orderBy: object) =>
  prisma.absensi.findMany({ where, select: absensiSelect, skip, take, orderBy });

export const count = (where: object) => prisma.absensi.count({ where });

// findFirst (not findUnique) so the pembimbing scope can be folded into the
// same query — an out-of-scope record reads as "tidak ditemukan".
export const findById = (id: string, pembimbingId?: string) =>
  prisma.absensi.findFirst({
    where: {
      id,
      ...(pembimbingId ? { pesertaMagang: { pembimbingLapanganId: pembimbingId } } : {}),
    },
    select: absensiSelect,
  });

export const pesertaExists = (pesertaMagangId: string, pembimbingId?: string) =>
  prisma.pesertaMagang.findFirst({
    where: { id: pesertaMagangId, ...(pembimbingId ? { pembimbingLapanganId: pembimbingId } : {}) },
  });

export const create = (data: {
  pesertaMagangId: string;
  kehadiran: Kehadiran;
  tanggal: Date;
  jamMasuk: Date | null;
  jamKeluar: Date | null;
  keterangan?: string;
  izinStatus?: IzinStatus | null;
  izinJenis?: Kehadiran | null;
}) => prisma.absensi.create({ data, select: absensiSelect });

export const update = (id: string, data: Prisma.AbsensiUncheckedUpdateInput) =>
  prisma.absensi.update({ where: { id }, data, select: absensiSelect });

export const remove = (id: string) => prisma.absensi.delete({ where: { id } });
