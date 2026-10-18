import { describe, expect, it } from "vitest";
import type { BalanceSummaryItem } from "@/lib/leave/balance";
import {
  buildPreview,
  formatDays,
  formatSummaryRange,
  formatWorkingDays,
} from "@/lib/leave/request-preview";

const VAC: BalanceSummaryItem = {
  leaveTypeId: "vac",
  leaveTypeName: "Vacation",
  tracksBalance: true,
  confirmed: 12,
  pending: 2,
  available: 10,
};
const UNPAID: BalanceSummaryItem = {
  leaveTypeId: "unp",
  leaveTypeName: "Unpaid",
  tracksBalance: false,
  confirmed: null,
  pending: 0,
  available: null,
};
const BALANCES = [VAC, UNPAID];

describe("formatSummaryRange", () => {
  it("writes weekdays and uses an en dash", () => {
    expect(formatSummaryRange("2026-11-02", "2026-11-04")).toBe("Mon 2 Nov – Wed 4 Nov 2026");
  });

  it("reads a single day without a range", () => {
    expect(formatSummaryRange("2026-11-02", "2026-11-02")).toBe("Mon 2 Nov 2026");
  });

  it("shows both years when the range crosses new year", () => {
    expect(formatSummaryRange("2026-12-30", "2027-01-02")).toBe("Wed 30 Dec 2026 – Sat 2 Jan 2027");
  });
});

describe("formatDays and formatWorkingDays", () => {
  it("uses the singular for 1 and -1, and a real minus sign", () => {
    expect(formatDays(7)).toBe("7 days");
    expect(formatDays(1)).toBe("1 day");
    expect(formatDays(0)).toBe("0 days");
    expect(formatDays(-1)).toBe("−1 day");
    expect(formatDays(-3)).toBe("−3 days");
  });

  it("pluralises working days", () => {
    expect(formatWorkingDays(3)).toBe("3 working days (Mon-Fri)");
    expect(formatWorkingDays(1)).toBe("1 working day (Mon-Fri)");
  });
});

describe("buildPreview", () => {
  const base = { balances: BALANCES, leaveTypeId: "vac" };

  it("is empty until both dates are real dates", () => {
    expect(buildPreview({ ...base, startDate: "", endDate: "" })).toEqual({ kind: "empty" });
    expect(buildPreview({ ...base, startDate: "2026-11-02", endDate: "" })).toEqual({
      kind: "empty",
    });
    expect(buildPreview({ ...base, startDate: "2026-02-30", endDate: "2026-03-02" })).toEqual({
      kind: "empty",
    });
  });

  it("is invalid when the end is before the start", () => {
    expect(buildPreview({ ...base, startDate: "2026-11-04", endDate: "2026-11-02" })).toEqual({
      kind: "invalid",
    });
  });

  it("matches the Figma Filled state: 3 working days leave 7 of 10", () => {
    const p = buildPreview({ ...base, startDate: "2026-11-02", endDate: "2026-11-04" });
    expect(p).toMatchObject({
      kind: "ready",
      leaveTypeName: "Vacation",
      rangeText: "Mon 2 Nov – Wed 4 Nov 2026",
      shortRangeText: "Nov 2–4 2026",
      days: 3,
      daysText: "3 working days (Mon-Fri)",
      balanceAfter: 7,
      balanceAfterText: "7 days",
      over: false,
    });
  });

  it("matches the Figma Over balance state: 11 working days leave −1", () => {
    const p = buildPreview({ ...base, startDate: "2026-11-02", endDate: "2026-11-16" });
    expect(p).toMatchObject({
      kind: "ready",
      days: 11,
      balanceAfter: -1,
      balanceAfterText: "−1 day",
      over: true,
    });
  });

  it("exactly using the balance is not over", () => {
    const p = buildPreview({ ...base, startDate: "2026-11-02", endDate: "2026-11-13" });
    expect(p).toMatchObject({ days: 10, balanceAfter: 0, over: false });
  });

  it("a type with no balance (Unpaid) has no balance line and is never over", () => {
    const p = buildPreview({
      balances: BALANCES,
      leaveTypeId: "unp",
      startDate: "2026-11-02",
      endDate: "2026-12-31",
    });
    expect(p).toMatchObject({
      kind: "ready",
      leaveTypeName: "Unpaid",
      balanceAfter: null,
      balanceAfterText: null,
      over: false,
    });
  });

  it("is empty for a leave type that is not in the list", () => {
    expect(
      buildPreview({
        ...base,
        leaveTypeId: "nope",
        startDate: "2026-11-02",
        endDate: "2026-11-04",
      }),
    ).toEqual({ kind: "empty" });
  });

  it("agrees with the server's own over-balance check", async () => {
    const { overBalanceWarning } = await import("@/lib/leave/balance");
    for (const end of ["2026-11-04", "2026-11-13", "2026-11-16"]) {
      const p = buildPreview({ ...base, startDate: "2026-11-02", endDate: end });
      if (p.kind !== "ready") throw new Error("expected ready");
      expect(p.over).toBe(overBalanceWarning(BALANCES, "vac", p.days) !== null);
    }
  });
});
