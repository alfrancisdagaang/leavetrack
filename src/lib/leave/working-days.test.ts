import { describe, expect, it } from "vitest";
import { countWorkingDays, isRealIsoDate } from "@/lib/leave/working-days";

describe("countWorkingDays", () => {
  it("counts a single weekday as one day", () => {
    expect(countWorkingDays("2026-10-14", "2026-10-14")).toBe(1); // Wednesday
  });

  it("counts Mon-Fri and skips the weekend", () => {
    expect(countWorkingDays("2026-10-12", "2026-10-18")).toBe(5); // Mon-Sun
    expect(countWorkingDays("2026-10-14", "2026-10-20")).toBe(5); // Wed-Tue
  });

  it("returns 0 for a weekend-only range", () => {
    expect(countWorkingDays("2026-10-17", "2026-10-18")).toBe(0);
  });

  it("returns 0 for a reversed or invalid range", () => {
    expect(countWorkingDays("2026-10-20", "2026-10-14")).toBe(0);
    expect(countWorkingDays("nope", "2026-10-14")).toBe(0);
  });

  it("is not shifted by month or year boundaries", () => {
    expect(countWorkingDays("2026-12-31", "2027-01-04")).toBe(3); // Thu, Fri, Mon
  });
});

describe("isRealIsoDate", () => {
  it("accepts real dates, including a leap day", () => {
    expect(isRealIsoDate("2026-10-14")).toBe(true);
    expect(isRealIsoDate("2028-02-29")).toBe(true);
  });

  it.each(["2026-02-30", "2026-13-01", "2026-1-1", "14/10/2026", "", "2026-10-14T00:00"])(
    "rejects %j",
    (value) => {
      expect(isRealIsoDate(value)).toBe(false);
    },
  );
});
