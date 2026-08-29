import { describe, expect, it } from "vitest";
import { uzDateTime, uzDayMonth, uzTime, uzWeekdayDayMonth } from "./uzDate";

// Constructed without a "Z" on purpose: the pages build dates the same way,
// so these are local-time instants and the assertions hold in any timezone.
const AUG_29 = new Date("2026-08-29T19:30:00");

describe("uzDate", () => {
  it("names the day and month in Uzbek", () => {
    expect(uzDayMonth(AUG_29)).toBe("29-avgust");
    expect(uzWeekdayDayMonth(AUG_29)).toBe("shanba, 29-avgust");
  });

  it("pads the clock to 24-hour form", () => {
    expect(uzTime(AUG_29)).toBe("19:30");
    expect(uzTime(new Date("2026-08-29T09:05:00"))).toBe("09:05");
    expect(uzTime(new Date("2026-08-29T00:00:00"))).toBe("00:00");
  });

  it("combines date and time", () => {
    expect(uzDateTime(AUG_29)).toBe("29-avgust 2026, 19:30");
  });

  it("covers every month and weekday", () => {
    // A missing or misordered entry would otherwise surface as "undefined"
    // in the UI on one specific day of the year.
    for (let month = 0; month < 12; month++) {
      expect(uzDayMonth(new Date(2026, month, 15))).not.toContain("undefined");
    }
    for (let day = 1; day <= 7; day++) {
      expect(uzWeekdayDayMonth(new Date(2026, 1, day))).not.toContain("undefined");
    }
  });

  it("does not depend on the browser carrying uz-UZ data", () => {
    // The regression this file exists for: Intl silently renders the ICU
    // root locale when uz-UZ is absent, producing strings like "M08 29, Sat".
    expect(uzWeekdayDayMonth(AUG_29)).not.toMatch(/M\d{2}|Sat|Aug/);
  });
});
