import { APP_TIMEZONE } from "./datetime";

// National + cuti bersama dates for Indonesia. Source of truth when online:
// https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/master/holidays.json
// (updated periodically). We cache in-process and fall back to an empty set so
// a network blip never breaks portal profile reads — weekends still exclude.
const HOLIDAYS_URL =
  "https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/master/holidays.json";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type HolidayCache = { loadedAt: number; dates: Set<string> };

let cache: HolidayCache | null = null;

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const loadIndonesiaHolidays = async (): Promise<Set<string>> => {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) {
    return cache.dates;
  }

  try {
    const response = await fetch(HOLIDAYS_URL, {
      // Node 18+ fetch. Cache hints are best-effort; we keep our own TTL above.
      headers: { Accept: "application/json" },
    });

    if (!response.ok) throw new Error(`holidays http ${response.status}`);

    const body = (await response.json()) as Record<string, unknown>;
    const dates = new Set<string>();

    for (const key of Object.keys(body)) {
      if (isIsoDate(key)) dates.add(key);
    }

    cache = { loadedAt: Date.now(), dates };
    return dates;
  } catch (error) {
    console.error("Failed to load Indonesia holidays", error);
    // Keep serving whatever we last had; otherwise weekends-only.
    if (cache) return cache.dates;
    cache = { loadedAt: Date.now(), dates: new Set() };
    return cache.dates;
  }
};

const weekdayInJakarta = (isoDate: string): number => {
  // en-US + Asia/Jakarta gives a stable Mon..Sun mapping independent of host TZ.
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
  }).format(new Date(`${isoDate}T12:00:00.000Z`));

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[label] ?? 0;
};

const addDaysIso = (isoDate: string, days: number): string => {
  const ms = Date.parse(`${isoDate}T00:00:00.000Z`) + days * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
};

export const isWeekend = (isoDate: string) => {
  const day = weekdayInJakarta(isoDate);
  return day === 0 || day === 6;
};

export const isWorkingDay = (isoDate: string, holidays: Set<string>) =>
  !isWeekend(isoDate) && !holidays.has(isoDate);

// Inclusive count of working days from `from` through `to` (both YYYY-MM-DD).
export const countWorkingDaysInclusive = (
  from: string,
  to: string,
  holidays: Set<string>
): number => {
  if (from > to) return 0;

  let count = 0;
  for (let cursor = from; cursor <= to; cursor = addDaysIso(cursor, 1)) {
    if (isWorkingDay(cursor, holidays)) count += 1;
  }
  return count;
};

// Remaining working days from tomorrow through tanggalSelesai (today already
// "used"). If selesai is in the past, 0. If no end date, null.
export const remainingWorkingDays = (
  today: string,
  tanggalSelesai: string | null | undefined,
  holidays: Set<string>
): number | null => {
  if (!tanggalSelesai) return null;
  const end = tanggalSelesai.slice(0, 10);
  const start = addDaysIso(today, 1);
  if (end < today) return 0;
  if (end < start) return isWorkingDay(end, holidays) && end === today ? 0 : 0;
  return countWorkingDaysInclusive(start, end, holidays);
};

export const remainingCalendarDays = (
  today: string,
  tanggalSelesai: string | null | undefined
): number | null => {
  if (!tanggalSelesai) return null;
  const end = tanggalSelesai.slice(0, 10);
  if (end < today) return 0;
  const diff =
    (Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) /
    (24 * 60 * 60 * 1000);
  return Math.max(0, Math.round(diff));
};
