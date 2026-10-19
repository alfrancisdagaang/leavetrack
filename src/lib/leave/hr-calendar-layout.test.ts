import { describe, expect, it } from "vitest";
import type { HrDayCount } from "@/lib/leave/hr-calendar";
import {
  longDay,
  monthBounds,
  orderTypeNames,
  outText,
  pendingText,
  peopleOut,
  typeCounts,
  typeText,
  weekdayWeeks,
} from "@/lib/leave/hr-calendar-layout";

const count = (over: Partial<HrDayCount> = {}): HrDayCount => ({
  day: "2026-11-04",
  total: 12,
  approved: 10,
  pending: 2,
  byType: [
    { leaveTypeName: "Sick", approved: 2, pending: 1 },
    { leaveTypeName: "Vacation", approved: 8, pending: 1 },
  ],
  ...over,
});

describe("hr calendar layout (EPIC-7)", () => {
  it("knows the first and last day of a month, leap February included", () => {
    expect(monthBounds({ year: 2026, month: 11 })).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(monthBounds({ year: 2028, month: 2 })).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });

  it("lays a month out as Monday-to-Friday weeks and never includes a weekend", () => {
    // November 2026 starts on a Sunday and ends on a Monday.
    const weeks = weekdayWeeks({ year: 2026, month: 11 });
    expect(weeks[0]).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ]);
    expect(weeks.at(-1)).toEqual(["2026-11-30", null, null, null, null]);
    for (const week of weeks) expect(week).toHaveLength(5);
    const days = weeks.flat().filter(Boolean) as string[];
    expect(days).toHaveLength(21);
    for (const d of days) {
      const weekday = new Date(`${d}T00:00:00Z`).getUTCDay();
      expect(weekday).toBeGreaterThanOrEqual(1);
      expect(weekday).toBeLessThanOrEqual(5);
    }
  });

  it("pads the first week when the month starts mid-week, and drops a week that has no weekday", () => {
    // October 2026 starts on a Thursday.
    const weeks = weekdayWeeks({ year: 2026, month: 10 });
    expect(weeks[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02"]);
    // March 2025 starts on a Saturday: its first row is the week of Monday the 3rd.
    expect(weekdayWeeks({ year: 2025, month: 3 })[0]).toEqual([
      "2025-03-03",
      "2025-03-04",
      "2025-03-05",
      "2025-03-06",
      "2025-03-07",
    ]);
  });

  it("writes a day's counts as text", () => {
    expect(outText(count())).toBe("12 out");
    expect(outText(undefined)).toBe("No one out");
    expect(outText(count({ total: 0 }))).toBe("No one out");
    expect(typeText(count())).toBe("Sick 3 · Vacation 9");
    expect(pendingText(count())).toBe("2 pending");
    expect(pendingText(count({ pending: 0 }))).toBe("0 pending");
    expect(pendingText(count({ total: 0, pending: 0, approved: 0, byType: [] }))).toBe("");
    expect(pendingText(undefined)).toBe("");
  });

  it("lists every leave type on a day, zero included, in the order given (reference polish)", () => {
    expect(typeText(count(), ["Vacation", "Sick", "Unpaid"])).toBe(
      "Vacation 9 · Sick 3 · Unpaid 0",
    );
    expect(typeText(count(), ["Sick"])).toBe("Sick 3");
    expect(typeText(undefined, ["Vacation"])).toBe("");
    expect(typeCounts(undefined, ["Vacation", "Sick"])).toEqual([
      { name: "Vacation", people: 0 },
      { name: "Sick", people: 0 },
    ]);
    expect(typeCounts(count(), ["Unpaid", "Vacation"])).toEqual([
      { name: "Unpaid", people: 0 },
      { name: "Vacation", people: 9 },
    ]);
  });

  it("orders the leave types as the design shows them", () => {
    expect(orderTypeNames(["Unpaid", "Sick", "Vacation"])).toEqual(["Vacation", "Sick", "Unpaid"]);
    expect(orderTypeNames(["Zeta", "Unpaid", "Alpha", "Vacation"])).toEqual([
      "Vacation",
      "Unpaid",
      "Alpha",
      "Zeta",
    ]);
  });

  it("writes a date and a head count", () => {
    expect(longDay("2026-11-04")).toBe("Wed 4 Nov 2026");
    expect(peopleOut(1)).toBe("1 person out");
    expect(peopleOut(12)).toBe("12 people out");
  });
});
