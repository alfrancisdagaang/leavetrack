import { describe, expect, it } from "vitest";
import { outToday, windowEnd, type OutFigures } from "@/lib/leave/out-figures";

const figures: OutFigures = {
  days: [
    { day: "2026-10-21", total: 5, pending: 2 },
    { day: "2026-10-22", total: 0, pending: 0 },
  ],
  weekPeople: 5,
  pendingTotal: 4,
};

describe("out figures helpers (dashboard rework)", () => {
  it("reads today's figures from the list of weekdays", () => {
    expect(outToday(figures, "2026-10-21")).toEqual({ weekend: false, total: 5, pending: 2 });
    expect(outToday(figures, "2026-10-22")).toEqual({ weekend: false, total: 0, pending: 0 });
  });

  it("a weekday that is not in the list counts as nobody out", () => {
    expect(outToday({ ...figures, days: [] }, "2026-10-21")).toEqual({
      weekend: false,
      total: 0,
      pending: 0,
    });
  });

  it("says weekend on a Saturday and a Sunday, whatever the list holds", () => {
    expect(outToday(figures, "2026-10-24")).toEqual({ weekend: true });
    expect(outToday(figures, "2026-10-25")).toEqual({ weekend: true });
  });

  it("the window runs through today + 6, across a month and a year edge", () => {
    expect(windowEnd("2026-10-21")).toBe("2026-10-27");
    expect(windowEnd("2026-10-28")).toBe("2026-11-03");
    expect(windowEnd("2026-12-29")).toBe("2027-01-04");
  });
});
