import { describe, expect, it } from "vitest";
import { summarizeBalances } from "@/lib/leave/balance";
import { summarizeBreakdown, yearBounds } from "@/lib/leave/breakdown";
import { todayIn } from "@/lib/leave/calendar-layout";

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const UNPAID = "10000000-0000-4000-8000-000000000003";
const TYPES = [
  { id: VAC, name: "Vacation", tracks_balance: true },
  { id: SICK, name: "Sick", tracks_balance: true },
  { id: UNPAID, name: "Unpaid", tracks_balance: false },
];

const run = (
  over: Partial<Parameters<typeof summarizeBreakdown>[0]> & {
    balances?: { leave_type_id: string; balance: string }[];
  } = {},
) =>
  summarizeBreakdown({
    types: TYPES,
    balances: [],
    pending: [],
    usedRanges: [],
    accrued: [],
    ...over,
  });
const vacation = (items: ReturnType<typeof run>) => items.find((i) => i.leaveTypeId === VAC)!;

describe("yearBounds (B13: the year follows the app time zone)", () => {
  it("is the calendar year of the given date, first to last day", () => {
    expect(yearBounds("2026-10-18")).toEqual({ year: 2026, from: "2026-01-01", to: "2026-12-31" });
  });

  it("uses the app time zone's year, not UTC's, around New Year", () => {
    const now = new Date("2026-12-31T20:00:00Z"); // 2027-01-01 04:00 in Manila
    expect(yearBounds(todayIn("UTC", now)).year).toBe(2026);
    expect(yearBounds(todayIn("Asia/Manila", now)).year).toBe(2027);
  });

  it("rejects something that is not an ISO date", () => {
    expect(() => yearBounds("soon")).toThrow();
  });
});

describe("summarizeBreakdown", () => {
  it("B2: opening + accrued - used = confirmed, for every input, including cents", () => {
    const cases: { confirmed: string; accrued: string[]; used: [string, string][] }[] = [
      { confirmed: "10.00", accrued: ["1.25", "1.25"], used: [["2026-03-02", "2026-03-04"]] },
      { confirmed: "11.25", accrued: [], used: [] },
      { confirmed: "0.00", accrued: ["0.10", "0.20"], used: [["2026-05-04", "2026-05-08"]] },
      { confirmed: "3.33", accrued: ["12.50", "0.07"], used: [["2026-06-01", "2026-06-02"]] },
      { confirmed: "5.00", accrued: ["15.00"], used: [] }, // negative derived value
    ];
    for (const c of cases) {
      const item = vacation(
        run({
          balances: [{ leave_type_id: VAC, balance: c.confirmed }],
          accrued: c.accrued.map((amount) => ({ leave_type_id: VAC, amount })),
          usedRanges: c.used.map(([start_date, end_date]) => ({
            leave_type_id: VAC,
            start_date,
            end_date,
          })),
        }),
      );
      const cents = (n: number | null) => Math.round((n ?? 0) * 100);
      expect(
        cents(item.openingBalance) + cents(item.accruedThisYear) - item.usedThisYear * 100,
      ).toBe(cents(item.confirmed));
    }
  });

  it("B1: a tracked type carries available, pending, used, accrued and the derived opening", () => {
    const item = vacation(
      run({
        balances: [{ leave_type_id: VAC, balance: "12.00" }],
        pending: [{ leave_type_id: VAC, start_date: "2026-11-02", end_date: "2026-11-03" }],
        usedRanges: [{ leave_type_id: VAC, start_date: "2026-03-02", end_date: "2026-03-06" }],
        accrued: [{ leave_type_id: VAC, amount: "15.00" }],
      }),
    );
    expect(item).toMatchObject({
      confirmed: 12,
      pending: 2,
      available: 10,
      usedThisYear: 5,
      accruedThisYear: 15,
      openingBalance: 2, // 12 + 5 - 15
    });
  });

  it("B4: counts weekdays only, so a Friday-to-Monday range is 2 days", () => {
    const item = vacation(
      run({
        usedRanges: [{ leave_type_id: VAC, start_date: "2026-11-06", end_date: "2026-11-09" }],
      }),
    );
    expect(item.usedThisYear).toBe(2);
  });

  it("B4: ranges clipped to a year count only that year's weekdays (Dec 29 to Jan 5)", () => {
    const in2026 = vacation(
      run({
        usedRanges: [{ leave_type_id: VAC, start_date: "2026-12-29", end_date: "2026-12-31" }],
      }),
    );
    const in2027 = vacation(
      run({
        usedRanges: [{ leave_type_id: VAC, start_date: "2027-01-01", end_date: "2027-01-05" }],
      }),
    );
    expect(in2026.usedThisYear).toBe(3); // Tue, Wed, Thu
    expect(in2027.usedThisYear).toBe(3); // Fri 1, Mon 4, Tue 5
  });

  it("B6: a tracked type with no ledger rows shows accrued 0 and opening = confirmed + used", () => {
    const sick = run({
      balances: [{ leave_type_id: SICK, balance: "5.00" }],
      usedRanges: [{ leave_type_id: SICK, start_date: "2026-04-06", end_date: "2026-04-07" }],
    }).find((i) => i.leaveTypeId === SICK)!;
    expect(sick.accruedThisYear).toBe(0);
    expect(sick.openingBalance).toBe(7);
  });

  it("B6: only the matching leave type's ledger and ranges count", () => {
    const items = run({
      balances: [
        { leave_type_id: VAC, balance: "10.00" },
        { leave_type_id: SICK, balance: "5.00" },
      ],
      accrued: [{ leave_type_id: SICK, amount: "2.00" }],
      usedRanges: [{ leave_type_id: SICK, start_date: "2026-04-06", end_date: "2026-04-06" }],
    });
    expect(vacation(items)).toMatchObject({ accruedThisYear: 0, usedThisYear: 0 });
    expect(items.find((i) => i.leaveTypeId === SICK)).toMatchObject({
      accruedThisYear: 2,
      usedThisYear: 1,
    });
  });

  it("B7: Unpaid has pending and used days only, never accrued, opening or available", () => {
    const unpaid = run({
      pending: [{ leave_type_id: UNPAID, start_date: "2026-11-02", end_date: "2026-11-02" }],
      usedRanges: [{ leave_type_id: UNPAID, start_date: "2026-08-03", end_date: "2026-08-04" }],
      accrued: [{ leave_type_id: UNPAID, amount: "9.00" }],
    }).find((i) => i.leaveTypeId === UNPAID)!;
    expect(unpaid).toMatchObject({
      tracksBalance: false,
      pending: 1,
      usedThisYear: 2,
      accruedThisYear: null,
      openingBalance: null,
      confirmed: null,
      available: null,
    });
  });

  it("B8: accrued above confirmed + used gives a negative derived value that still reconciles", () => {
    const item = vacation(
      run({
        balances: [{ leave_type_id: VAC, balance: "5.00" }],
        accrued: [{ leave_type_id: VAC, amount: "15.00" }],
      }),
    );
    expect(item.openingBalance).toBe(-10);
    expect(item.openingBalance! + item.accruedThisYear! - item.usedThisYear).toBe(item.confirmed);
  });

  it("B10: the fields the dashboard and Request Leave read are exactly summarizeBalances' output", () => {
    const input = {
      types: TYPES,
      balances: [{ leave_type_id: VAC, balance: "11.25" }],
      pending: [{ leave_type_id: VAC, start_date: "2026-11-02", end_date: "2026-11-04" }],
    };
    const base = summarizeBalances(input.types, input.balances, input.pending);
    const wide = summarizeBreakdown({
      ...input,
      usedRanges: [{ leave_type_id: VAC, start_date: "2026-03-02", end_date: "2026-03-06" }],
      accrued: [{ leave_type_id: VAC, amount: "1.25" }],
    });
    expect(
      wide.map(({ usedThisYear: _u, accruedThisYear: _a, openingBalance: _o, ...rest }) => rest),
    ).toEqual(base);
  });
});
