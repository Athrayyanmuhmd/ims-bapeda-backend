import { describe, expect, it } from "vitest";
import {
  APP_UTC_OFFSET,
  dayRange,
  endOfDay,
  isWithinCheckInWindow,
  parseDateOnly,
  parseWallClock,
} from "./datetime";

describe("parseDateOnly", () => {
  // UTC midnight is what @@unique([pesertaMagangId, tanggal]) relies on, and
  // what keeps the calendar date stable for any reader.
  it("anchors a calendar date at UTC midnight", () => {
    expect(parseDateOnly("2026-07-16").toISOString()).toBe("2026-07-16T00:00:00.000Z");
  });

  // The bug this replaced: new Date("2026-07-16T00:00:00") is host-local, so on a
  // WIB machine it became 2026-07-15T17:00Z and the stored date shifted a day.
  it("does not depend on the host timezone", () => {
    expect(parseDateOnly("2026-01-01").toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(parseDateOnly("2026-12-31").toISOString()).toBe("2026-12-31T00:00:00.000Z");
  });
});

describe("parseWallClock", () => {
  it("pins a zone-less timestamp to the office offset", () => {
    // 08:00 WIB is 01:00Z — the instant no longer depends on where this runs.
    expect(parseWallClock("2026-07-16T08:00:00").toISOString()).toBe("2026-07-16T01:00:00.000Z");
  });

  it("uses the configured offset", () => {
    expect(APP_UTC_OFFSET).toBe("+07:00");
  });

  it("respects a timestamp that already carries a zone", () => {
    expect(parseWallClock("2026-07-16T08:00:00Z").toISOString()).toBe("2026-07-16T08:00:00.000Z");
    expect(parseWallClock("2026-07-16T08:00:00+09:00").toISOString()).toBe("2026-07-15T23:00:00.000Z");
  });

  it("routes a bare date through parseDateOnly", () => {
    expect(parseWallClock("2026-07-16").toISOString()).toBe("2026-07-16T00:00:00.000Z");
  });
});

describe("dayRange", () => {
  it("covers exactly one day, half-open so midnight can't match twice", () => {
    expect(dayRange("2026-07-16")).toEqual({
      gte: new Date("2026-07-16T00:00:00.000Z"),
      lt: new Date("2026-07-17T00:00:00.000Z"),
    });
  });

  it("matches a record written by parseDateOnly for the same date", () => {
    const { gte, lt } = dayRange("2026-07-16");
    const stored = parseDateOnly("2026-07-16");

    expect(stored >= gte).toBe(true);
    expect(stored < lt).toBe(true);
  });
});

describe("endOfDay", () => {
  it("is inclusive of the whole named day", () => {
    expect(endOfDay("2026-07-16").toISOString()).toBe("2026-07-16T23:59:59.999Z");
  });
});

describe("isWithinCheckInWindow", () => {
  it("is open at the start and closed at the end (default 07:00–09:00)", () => {
    expect(isWithinCheckInWindow("07:00")).toBe(true);
    expect(isWithinCheckInWindow("08:30")).toBe(true);
    expect(isWithinCheckInWindow("09:00")).toBe(false);
    expect(isWithinCheckInWindow("06:59")).toBe(false);
  });
});
