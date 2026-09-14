// Dates reach this API as wall-clock strings with no timezone: "2026-07-16" from
// an <input type="date">, "2026-07-16T08:00:00" from a date + time pair.
//
// `new Date()` reads the second form in the *server's* timezone, so the exact
// same input landed on a different instant locally (WIB) than on Vercel (UTC) —
// jam absensi shifted by the offset depending on where the code ran, and the
// date filters (built with local midnight) disagreed with the stored values
// (built with UTC midnight). Both forms are pinned here instead.
//
// ponytail: one office, one timezone — a single fixed offset, not per-user
// zones. Override with APP_UTC_OFFSET if Bapeda ever spans more than one.
export const APP_UTC_OFFSET = process.env.APP_UTC_OFFSET ?? "+07:00"; // WIB

// IANA name for the same zone, for the Intl-based helpers below. Keep the two in
// step if either is overridden.
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Jakarta";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// A calendar date carries no time. Anchoring it at UTC midnight keeps the date
// component stable no matter which zone reads it back, which is also what the
// @@unique([pesertaMagangId, tanggal]) constraint depends on.
export const parseDateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

// A wall-clock timestamp is pinned to the office offset so the stored instant is
// the same regardless of host timezone. A value that already carries a zone is
// trusted as-is; a bare date falls through to parseDateOnly.
export const parseWallClock = (value: string): Date => {
  if (DATE_ONLY.test(value)) return parseDateOnly(value);
  return new Date(HAS_ZONE.test(value) ? value : `${value}${APP_UTC_OFFSET}`);
};

// Half-open window covering one calendar day, in the same UTC frame as
// parseDateOnly so an exact-date filter matches what was written.
export const dayRange = (value: string) => {
  const start = parseDateOnly(value);
  return { gte: start, lt: new Date(start.getTime() + MS_PER_DAY) };
};

// End of a range is inclusive of the whole day the caller named.
export const endOfDay = (value: string): Date =>
  new Date(parseDateOnly(value).getTime() + MS_PER_DAY - 1);

// "Hari ini" as the office reckons it, never as the host does — a server on UTC
// would otherwise roll the date over at 07:00 WIB, mid working day. en-CA is
// used purely because it formats as YYYY-MM-DD.
export const todayIsoDate = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date());

// Whole calendar days from today (office zone) until a stored Date/ISO.
// Negative = already past. Matches the backoffice daysUntil helper.
export const daysUntil = (value: Date | string): number => {
  const iso = typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  const today = parseDateOnly(todayIsoDate()).getTime();
  const target = parseDateOnly(iso).getTime();
  return Math.round((target - today) / MS_PER_DAY);
};

// Current wall-clock HH:mm in the office zone, so a server-stamped check-in
// matches the time the peserta sees on their own screen.
export const nowJam = (): string =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

// Portal check-in is only allowed inside this office-local window (inclusive start,
// exclusive end). Override with CHECKIN_START / CHECKIN_END (HH:mm).
export const CHECKIN_START = process.env.CHECKIN_START ?? "07:00";
export const CHECKIN_END = process.env.CHECKIN_END ?? "09:00";

// After this office-local time, open Hadir rows (jamMasuk set, jamKeluar null)
// are stamped with jamKeluar = CHECKOUT_AUTO_AT so the day doesn't stay blank.
export const CHECKOUT_AUTO_AT = process.env.CHECKOUT_AUTO_AT ?? "17:00";

const jamToMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.NaN;
  return h * 60 + m;
};

export const isWithinCheckInWindow = (jam = nowJam()): boolean => {
  const now = jamToMinutes(jam);
  const start = jamToMinutes(CHECKIN_START);
  const end = jamToMinutes(CHECKIN_END);
  if ([now, start, end].some((n) => Number.isNaN(n))) return false;
  return now >= start && now < end;
};

export const checkInWindowLabel = () => `${CHECKIN_START}–${CHECKIN_END} WIB`;

// Past calendar days always qualify; today only after CHECKOUT_AUTO_AT.
export const shouldAutoCheckout = (tanggalIso: string, jam = nowJam()): boolean => {
  const today = todayIsoDate();
  if (tanggalIso < today) return true;
  if (tanggalIso > today) return false;
  const now = jamToMinutes(jam);
  const cutoff = jamToMinutes(CHECKOUT_AUTO_AT);
  if ([now, cutoff].some((n) => Number.isNaN(n))) return false;
  return now >= cutoff;
};
