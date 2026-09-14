import { IzinStatus, StatusMagang } from "@prisma/client";
import { dayRange, daysUntil, todayIsoDate } from "../../lib/datetime";
import prisma from "../../lib/prisma";
import { success } from "../../lib/serviceResult";

const SOON_DAYS = 30;

export const getSummary = async (pembimbingId?: string) => {
  const today = todayIsoDate();
  const pesertaScope = pembimbingId ? { pembimbingLapanganId: pembimbingId } : {};

  const [aktifPeserta, todayAbsensi, pendingRows] = await Promise.all([
    prisma.pesertaMagang.findMany({
      where: { status: StatusMagang.AKTIF, ...pesertaScope },
      select: {
        id: true,
        name: true,
        tanggalSelesai: true,
        divisi: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.absensi.findMany({
      where: {
        tanggal: dayRange(today),
        ...(pembimbingId ? { pesertaMagang: { pembimbingLapanganId: pembimbingId } } : {}),
      },
      select: { pesertaMagangId: true },
    }),
    prisma.absensi.findMany({
      where: {
        izinStatus: IzinStatus.PENDING,
        ...(pembimbingId ? { pesertaMagang: { pembimbingLapanganId: pembimbingId } } : {}),
      },
      select: {
        id: true,
        pesertaMagangId: true,
        kehadiran: true,
        izinJenis: true,
        keterangan: true,
        tanggal: true,
        pesertaMagang: { select: { name: true, divisi: { select: { name: true } } } },
      },
      orderBy: { tanggal: "desc" },
      take: 50,
    }),
  ]);

  const hadAbsensiToday = new Set(todayAbsensi.map((a) => a.pesertaMagangId));

  const endingSoon = aktifPeserta
    .flatMap((p) => {
      if (!p.tanggalSelesai) return [];
      const left = daysUntil(p.tanggalSelesai);
      if (left > SOON_DAYS) return [];
      return [
        {
          id: p.id,
          name: p.name,
          divisi: p.divisi?.name ?? null,
          tanggalSelesai: p.tanggalSelesai,
          daysLeft: left,
        },
      ];
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const belumAbsen = aktifPeserta
    .filter((p) => !hadAbsensiToday.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      divisi: p.divisi?.name ?? null,
    }));

  const pendingIzin = pendingRows.map((a) => ({
    id: a.id,
    pesertaMagangId: a.pesertaMagangId,
    name: a.pesertaMagang.name,
    divisi: a.pesertaMagang.divisi?.name ?? null,
    jenis: a.izinJenis ?? a.kehadiran,
    keterangan: a.keterangan,
    tanggal: a.tanggal,
  }));

  return success({
    endingSoon,
    belumAbsen,
    pendingIzin,
    counts: {
      endingSoon: endingSoon.length,
      belumAbsen: belumAbsen.length,
      pendingIzin: pendingIzin.length,
    },
  });
};
