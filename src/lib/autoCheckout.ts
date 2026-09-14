import {
  CHECKOUT_AUTO_AT,
  dayRange,
  nowJam,
  parseWallClock,
  shouldAutoCheckout,
  todayIsoDate,
} from "./datetime";
import prisma from "./prisma";

type AbsensiCheckoutRow = {
  id: string;
  jamMasuk: Date | null;
  jamKeluar: Date | null;
  kehadiran: string;
  tanggal: Date;
};

// Persist 17:00 (or CHECKOUT_AUTO_AT) when a Hadir row still has no jamKeluar
// after the office day ends — so rekap/portal never show an empty checkout.
export const applyAutoCheckout = async <T extends AbsensiCheckoutRow>(
  row: T,
  select: object
): Promise<T> => {
  if (row.jamKeluar || !row.jamMasuk) return row;
  if (row.kehadiran !== "Hadir") return row;

  const tanggalIso = row.tanggal.toISOString().slice(0, 10);
  if (!shouldAutoCheckout(tanggalIso)) return row;

  const jamKeluar = parseWallClock(`${tanggalIso}T${CHECKOUT_AUTO_AT}:00`);
  // Never invent a checkout earlier than the check-in itself.
  if (jamKeluar.getTime() <= row.jamMasuk.getTime()) return row;

  return prisma.absensi.update({
    where: { id: row.id },
    data: { jamKeluar },
    select,
  }) as Promise<T>;
};

export const applyAutoCheckoutMany = async <T extends AbsensiCheckoutRow>(
  rows: T[],
  select: object
): Promise<T[]> => {
  return Promise.all(rows.map((row) => applyAutoCheckout(row, select)));
};

// Bulk-close today's open Hadir rows once the clock passes CHECKOUT_AUTO_AT.
// Used by the staff roster so pembimbing sees 17:00 without waiting for each
// peserta to open the portal.
export const closeOpenCheckoutsForDate = async (tanggalIso = todayIsoDate()) => {
  if (!shouldAutoCheckout(tanggalIso, nowJam())) return 0;

  const jamKeluar = parseWallClock(`${tanggalIso}T${CHECKOUT_AUTO_AT}:00`);

  const result = await prisma.absensi.updateMany({
    where: {
      tanggal: dayRange(tanggalIso),
      kehadiran: "Hadir",
      jamMasuk: { not: null, lt: jamKeluar },
      jamKeluar: null,
    },
    data: { jamKeluar },
  });

  return result.count;
};
