import { describe, expect, it } from "vitest";
import {
  countWorkingDaysInclusive,
  remainingCalendarDays,
  remainingWorkingDays,
} from "./indonesiaHolidays";

describe("working day helpers", () => {
  const holidays = new Set(["2026-08-17"]); // Senin kemerdekaan (example)

  it("counts Mon–Fri and skips weekends + holidays", () => {
    // 2026-08-14 Fri, 15 Sat, 16 Sun, 17 Mon holiday, 18 Tue
    expect(countWorkingDaysInclusive("2026-08-14", "2026-08-18", holidays)).toBe(2);
  });

  it("remaining working days starts from tomorrow", () => {
    expect(remainingWorkingDays("2026-08-14", "2026-08-18", holidays)).toBe(1); // 18 only
    expect(remainingWorkingDays("2026-08-18", "2026-08-18", holidays)).toBe(0);
    expect(remainingWorkingDays("2026-08-19", "2026-08-18", holidays)).toBe(0);
  });

  it("remaining calendar days is inclusive of end date distance", () => {
    expect(remainingCalendarDays("2026-08-14", "2026-08-18")).toBe(4);
    expect(remainingCalendarDays("2026-08-18", "2026-08-18")).toBe(0);
  });
});
