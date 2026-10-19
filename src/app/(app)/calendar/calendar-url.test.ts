import { describe, expect, it } from "vitest";
import type { HrCalendarQuery } from "@/lib/leave/schemas";
import { calendarHref } from "./calendar-url";

const base: HrCalendarQuery = {
  month: undefined,
  managerId: undefined,
  leaveTypeId: undefined,
  day: undefined,
  q: undefined,
  page: 1,
};

describe("calendarHref (EPIC-7)", () => {
  it("writes only the values that are set", () => {
    expect(calendarHref(base)).toBe("/calendar");
    expect(calendarHref({ ...base, month: "2026-12", managerId: "m", leaveTypeId: "t" })).toBe(
      "/calendar?month=2026-12&team=m&type=t",
    );
  });

  it("keeps a name search and a page only while a day is open", () => {
    const withDay = { ...base, day: "2026-11-04", q: "ana", page: 2 };
    expect(calendarHref(withDay)).toBe("/calendar?day=2026-11-04&q=ana&page=2");
    expect(calendarHref(withDay, { day: undefined })).toBe("/calendar");
    expect(calendarHref(base, { q: "ana", page: 3 })).toBe("/calendar");
  });

  it("applies a change on top of the current filters", () => {
    const query = { ...base, month: "2026-11", managerId: "m" };
    expect(calendarHref(query, { month: "2026-12" })).toBe("/calendar?month=2026-12&team=m");
  });
});
