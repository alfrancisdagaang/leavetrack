import { describe, expect, it } from "vitest";
import type { LeaveType } from "@/lib/db/types";
import { overBalanceWarning, summarizeBalances } from "@/lib/leave/balance";

const VACATION: LeaveType = { id: "t-vac", name: "Vacation", tracks_balance: true };
const SICK: LeaveType = { id: "t-sick", name: "Sick", tracks_balance: true };
const UNPAID: LeaveType = { id: "t-unpaid", name: "Unpaid", tracks_balance: false };
const TYPES = [VACATION, SICK, UNPAID];

const balances = [
  { leave_type_id: "t-vac", balance: "10.00" },
  { leave_type_id: "t-sick", balance: "5.00" },
];

describe("summarizeBalances", () => {
  it("US-02 AC1: reports the confirmed balance per leave type", () => {
    const [vac, sick, unpaid] = summarizeBalances(TYPES, balances, []);
    expect(vac).toMatchObject({
      leaveTypeName: "Vacation",
      confirmed: 10,
      pending: 0,
      available: 10,
    });
    expect(sick).toMatchObject({ confirmed: 5, available: 5 });
    expect(unpaid).toMatchObject({ tracksBalance: false, confirmed: null, available: null });
  });

  it("US-02 AC2: shows pending days separately and does not deduct them from confirmed", () => {
    const pending = [
      { leave_type_id: "t-vac", start_date: "2026-10-20", end_date: "2026-10-22" }, // 3 days
      { leave_type_id: "t-sick", start_date: "2026-10-23", end_date: "2026-10-26" }, // Fri + Mon = 2
    ];
    const [vac, sick] = summarizeBalances(TYPES, balances, pending);
    expect(vac).toMatchObject({ confirmed: 10, pending: 3, available: 7 });
    expect(sick).toMatchObject({ confirmed: 5, pending: 2, available: 3 });
  });

  it("treats a tracked type with no balance row as zero", () => {
    const [vac] = summarizeBalances([VACATION], [], []);
    expect(vac).toMatchObject({ confirmed: 0, available: 0 });
  });

  it("still reports pending days for a type without a balance", () => {
    const pending = [
      { leave_type_id: "t-unpaid", start_date: "2026-10-20", end_date: "2026-10-21" },
    ];
    const unpaid = summarizeBalances(TYPES, balances, pending)[2];
    expect(unpaid).toMatchObject({ pending: 2, confirmed: null, available: null });
  });
});

describe("overBalanceWarning", () => {
  const summary = summarizeBalances(TYPES, balances, [
    { leave_type_id: "t-vac", start_date: "2026-10-20", end_date: "2026-10-22" },
  ]); // Vacation: 10 confirmed, 3 pending, 7 available

  it("US-01 AC3: warns when the request exceeds what is available", () => {
    const warning = overBalanceWarning(summary, "t-vac", 8);
    expect(warning).toMatchObject({ code: "OVER_BALANCE", requestedDays: 8, availableDays: 7 });
    expect(warning?.message).toContain("HR override");
  });

  it("does not warn when the request fits, including exactly the available amount", () => {
    expect(overBalanceWarning(summary, "t-vac", 7)).toBeNull();
    expect(overBalanceWarning(summary, "t-vac", 1)).toBeNull();
  });

  it("never warns for a type without a balance (Unpaid)", () => {
    expect(overBalanceWarning(summary, "t-unpaid", 500)).toBeNull();
  });

  it("never reports a negative number of available days", () => {
    const over = summarizeBalances(
      [VACATION],
      [{ leave_type_id: "t-vac", balance: "2.00" }],
      [
        { leave_type_id: "t-vac", start_date: "2026-10-19", end_date: "2026-10-23" }, // 5 pending
      ],
    );
    expect(overBalanceWarning(over, "t-vac", 1)?.availableDays).toBe(0);
  });

  it("ignores an unknown leave type", () => {
    expect(overBalanceWarning(summary, "nope", 5)).toBeNull();
  });
});
