import { describe, expect, it } from "vitest";
import {
  layoutWeek,
  monthGrid,
  monthKey,
  monthTitle,
  parseMonthParam,
  shiftMonth,
  summarizeOwners,
  todayIn,
  type CalendarRequest,
} from "@/lib/leave/calendar-layout";

const MARCO = "00000000-0000-4000-8000-000000000002";

const req = (id: string, start: string, end: string, over: Partial<CalendarRequest> = {}) => ({
  id,
  userId: MARCO,
  userName: "Marco Santos",
  leaveTypeName: "Vacation",
  startDate: start,
  endDate: end,
  status: "approved" as const,
  ...over,
});

const october = monthGrid({ year: 2026, month: 10 });

describe("monthGrid", () => {
  it("covers October 2026 with five Sunday-first weeks from 27 Sep to 31 Oct", () => {
    expect(october.weeks).toHaveLength(5);
    expect(october.from).toBe("2026-09-27");
    expect(october.to).toBe("2026-10-31");
    expect(october.weeks[0]).toEqual([
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });

  it("uses only the weeks a month needs (4 for February 2026, which starts on a Sunday)", () => {
    expect(monthGrid({ year: 2026, month: 2 }).weeks).toHaveLength(4);
  });

  it("runs into the next month's first week when the month ends mid-week", () => {
    expect(monthGrid({ year: 2026, month: 11 }).to).toBe("2026-12-05");
  });
});

describe("month params", () => {
  const today = "2026-10-15";

  it("parses a valid YYYY-MM", () => {
    expect(parseMonthParam("2026-11", today)).toEqual({ year: 2026, month: 11 });
  });

  it("falls back to today's month for missing, malformed or out-of-range values", () => {
    const bad = [undefined, "", "2026-13", "2026-00", "nov", "2026-1", "1850-05", "2026-10-01"];
    for (const value of bad) {
      expect(parseMonthParam(value, today)).toEqual({ year: 2026, month: 10 });
    }
  });

  it("moves between months across a year boundary", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(monthKey({ year: 2026, month: 3 })).toBe("2026-03");
    expect(monthTitle({ year: 2026, month: 10 })).toBe("October 2026");
  });
});

describe("todayIn", () => {
  const instant = new Date("2026-10-14T20:00:00Z");

  it("is a different day in a different time zone for the same instant", () => {
    expect(todayIn("UTC", instant)).toBe("2026-10-14");
    expect(todayIn("Asia/Manila", instant)).toBe("2026-10-15");
  });
});

describe("layoutWeek", () => {
  const week1 = october.weeks[0]!;
  const week2 = october.weeks[1]!;
  const week4 = october.weeks[3]!; // Sunday 18 Oct

  it("puts Oct 1-3 on Thursday to Saturday (columns 5-7)", () => {
    const { segments, lanes } = layoutWeek([req("a", "2026-10-01", "2026-10-03")], week1);
    expect(lanes).toBe(1);
    expect(segments).toMatchObject([
      { column: 5, span: 3, lane: 1, startsHere: true, endsHere: true },
    ]);
  });

  it("draws a single day as one column", () => {
    const { segments } = layoutWeek([req("a", "2026-10-08", "2026-10-08")], week2);
    expect(segments).toMatchObject([{ column: 5, span: 1 }]);
  });

  it("splits a request that crosses a week boundary into two clipped segments", () => {
    const r = req("a", "2026-10-02", "2026-10-06");
    const first = layoutWeek([r], week1).segments[0]!;
    const second = layoutWeek([r], week2).segments[0]!;
    expect(first).toMatchObject({ column: 6, span: 2, startsHere: true, endsHere: false });
    expect(second).toMatchObject({ column: 1, span: 3, startsHere: false, endsHere: true });
  });

  it("includes a request that starts before the grid and ends inside it", () => {
    const { segments } = layoutWeek([req("a", "2026-09-20", "2026-09-29")], week1);
    expect(segments).toMatchObject([{ column: 1, span: 3, startsHere: false, endsHere: true }]);
  });

  it("leaves out requests that do not touch the week", () => {
    expect(layoutWeek([req("a", "2026-11-02", "2026-11-04")], week1)).toEqual({
      segments: [],
      lanes: 0,
    });
  });

  it("stacks overlapping requests on different lanes and reuses a freed lane", () => {
    const { segments, lanes } = layoutWeek(
      [
        req("a", "2026-10-19", "2026-10-21"),
        req("b", "2026-10-20", "2026-10-22"),
        req("c", "2026-10-22", "2026-10-23"),
      ],
      week4,
    );
    const lane = (id: string) => segments.find((s) => s.request.id === id)!.lane;
    expect(lanes).toBe(2);
    expect(lane("a")).toBe(1);
    expect(lane("b")).toBe(2);
    expect(lane("c")).toBe(1); // a ended on Wednesday, so Thursday's first lane is free
  });

  it("never lets two bars in one lane overlap", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      req(`r${String(i).padStart(2, "0")}`, `2026-10-${19 + (i % 4)}`, `2026-10-${20 + (i % 5)}`),
    );
    const { segments } = layoutWeek(many, week4);
    for (const a of segments) {
      for (const b of segments) {
        if (a === b || a.lane !== b.lane) continue;
        const aEnd = a.column + a.span - 1;
        const bEnd = b.column + b.span - 1;
        expect(a.column > bEnd || b.column > aEnd).toBe(true);
      }
    }
  });
});

describe("summarizeOwners", () => {
  const month = { year: 2026, month: 10 };

  it("writes the viewer's own dates once, then the others by person", () => {
    const text = summarizeOwners(
      [
        req("1", "2026-10-01", "2026-10-03"),
        req("2", "2026-10-08", "2026-10-08"),
        req("3", "2026-10-26", "2026-10-28"),
        req("4", "2026-10-30", "2026-10-30"),
        req("5", "2026-10-19", "2026-10-21", { userId: "p", userName: "Priya Shah" }),
        req("6", "2026-10-23", "2026-10-23", { userId: "l", userName: "Leo Garcia" }),
        req("7", "2026-10-29", "2026-10-30", { userId: "a", userName: "Ana Lopez" }),
      ],
      MARCO,
      month,
    );
    expect(text.you).toBe("Oct 1–3, 8, 26–28 and 30");
    expect(text.others).toBe("Priya 19–21 · Leo 23 · Ana 29–30");
  });

  it("spells out both months when a request leaves the month being shown", () => {
    const text = summarizeOwners([req("1", "2026-10-30", "2026-11-02")], MARCO, month);
    expect(text.you).toContain("Oct 30–Nov 2");
  });

  it("is empty when there is nothing to list", () => {
    expect(summarizeOwners([], MARCO, month)).toEqual({ you: null, others: null });
  });
});
