import { describe, expect, it } from "vitest";
import { parseHrCalendarQuery } from "@/lib/leave/schemas";

const UUID = "20000000-0000-4000-8000-000000000001";

describe("parseHrCalendarQuery (EPIC-7 TASK-043)", () => {
  it("defaults to no filters and the current month", () => {
    const { query, ignored } = parseHrCalendarQuery({}, "2026-11");
    expect(query).toEqual({
      month: undefined,
      managerId: undefined,
      leaveTypeId: undefined,
      day: undefined,
      q: undefined,
      page: 1,
    });
    expect(ignored).toEqual([]);
  });

  it("reads every valid value", () => {
    const { query, ignored } = parseHrCalendarQuery(
      { month: "2026-12", team: UUID, type: UUID, day: "2026-12-03", q: " ana ", page: "2" },
      "2026-11",
    );
    expect(query).toEqual({
      month: "2026-12",
      managerId: UUID,
      leaveTypeId: UUID,
      day: "2026-12-03",
      q: "ana",
      page: 2,
    });
    expect(ignored).toEqual([]);
  });

  it("drops a bad value on its own and names it, never failing", () => {
    const { query, ignored } = parseHrCalendarQuery(
      { month: "2026-13", team: "x", type: "y", day: "nope", q: "ana", page: "3" },
      "2026-11",
    );
    expect(query.month).toBeUndefined();
    expect(query.managerId).toBeUndefined();
    expect(query.leaveTypeId).toBeUndefined();
    expect(query.day).toBeUndefined();
    expect(ignored).toEqual(["month", "team", "leave type", "day"]);
    // A name search and a page only matter once a day is open.
    expect(query.q).toBeUndefined();
    expect(query.page).toBe(1);
  });

  it("only opens a real weekday inside the month shown", () => {
    // 2026-11-07 is a Saturday, 2026-11-08 a Sunday, 2026-02-30 is not a date.
    for (const day of ["2026-11-07", "2026-11-08", "2026-02-30", "2026-12-01"]) {
      expect(parseHrCalendarQuery({ day }, "2026-11").ignored).toContain("day");
    }
    expect(parseHrCalendarQuery({ day: "2026-12-01", month: "2026-12" }, "2026-11").query.day).toBe(
      "2026-12-01",
    );
    expect(parseHrCalendarQuery({ day: "2026-11-06" }, "2026-11").query.day).toBe("2026-11-06");
  });

  it("limits the search length and the page number", () => {
    const long = "a".repeat(61);
    expect(parseHrCalendarQuery({ day: "2026-11-06", q: long }, "2026-11").ignored).toContain(
      "search",
    );
    expect(parseHrCalendarQuery({ day: "2026-11-06", page: "0" }, "2026-11").ignored).toContain(
      "page",
    );
    expect(parseHrCalendarQuery({ day: "2026-11-06", page: "1001" }, "2026-11").ignored).toContain(
      "page",
    );
  });
});
