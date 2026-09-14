import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";

export const pesertaSelect = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  nim: true,
  // Selected only so present() can report whether the portal account is active.
  // present() is the single exit point for every peserta response and replaces
  // this with a boolean — the hash itself must never reach a response body.
  password: true,
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

// findFirst (not findUnique) so the pembimbing scope can be folded into the
// same query: an out-of-scope record comes back null and every caller already
// turns null into "tidak ditemukan", which also avoids leaking its existence.
export const findById = (id: string, pembimbingId?: string) =>
  prisma.pesertaMagang.findFirst({
    where: { id, ...(pembimbingId ? { pembimbingLapanganId: pembimbingId } : {}) },
    select: pesertaSelect,
  });

export const create = (data: Prisma.PesertaMagangUncheckedCreateInput) =>
  prisma.pesertaMagang.create({ data, select: pesertaSelect });

export const update = (id: string, data: Record<string, unknown>) =>
  prisma.pesertaMagang.update({ where: { id }, data, select: pesertaSelect });

export const remove = (id: string) => prisma.pesertaMagang.delete({ where: { id } });
