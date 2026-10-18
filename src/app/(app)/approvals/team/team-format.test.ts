import { describe, expect, it } from "vitest";
import { formatDays, ROLE_LABEL, rosterStatusText, STATUS_BADGE } from "./team-format";

describe("team format helpers", () => {
  it("writes days with singular and plural and keeps decimals", () => {
    expect(formatDays(1)).toBe("1 day");
    expect(formatDays(0)).toBe("0 days");
    expect(formatDays(8)).toBe("8 days");
    expect(formatDays(11.25)).toBe("11.25 days");
    expect(formatDays(-3)).toBe("−3 days");
  });

  it("writes the roster status as text (US-12 AC2)", () => {
    expect(rosterStatusText({ kind: "out_today" })).toBe("Out today");
    expect(rosterStatusText({ kind: "next_leave", start: "2026-11-02" })).toBe("Next leave: Nov 2");
    expect(rosterStatusText({ kind: "none" })).toBe("No leave planned");
  });

  it("labels the three roles and writes every status out", () => {
    expect(ROLE_LABEL).toEqual({ employee: "Employee", manager: "Manager", hr_admin: "HR Admin" });
    expect(Object.values(STATUS_BADGE).map((s) => s.label)).toEqual([
      "Pending",
      "Approved",
      "Rejected",
    ]);
  });
});
