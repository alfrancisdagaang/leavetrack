import type { LeaveBalance, LeaveRequest, LeaveType } from "@/lib/db/types";
import { summarizeBalances, type BalanceSummaryItem } from "@/lib/leave/balance";
import type { IsoDate } from "@/lib/leave/calendar-layout";
import { countWorkingDays } from "@/lib/leave/working-days";

/**
 * My Balance breakdown: how a leave type's days are made up. Pure functions, no database access.
 * The shared `summarizeBalances` (dashboard, Request Leave, the over-balance warning) is wrapped,
 * never changed, so those pages cannot change with this file.
 */

export type YearBounds = { year: number; from: IsoDate; to: IsoDate };

/** The calendar year of `today` (already in the app time zone): first and last day, as ISO dates. */
export function yearBounds(today: IsoDate): YearBounds {
  const year = Number(today.slice(0, 4));
  if (!Number.isInteger(year) || year < 1000) throw new Error("yearBounds needs an ISO date");
  return { year, from: `${year}-01-01`, to: `${year}-12-31` };
}

/** A range of days that is already clipped to the year, as the database returns it. */
export type UsedRange = Pick<LeaveRequest, "leave_type_id" | "start_date" | "end_date">;

/** One ledger total for the year: a text amount (`numeric` as text), summed in SQL. */
export type AccruedTotal = { leave_type_id: string; amount: string };

/**
 * One row of the My Balance page. Days are working days.
 * `usedThisYear`: approved, non-deleted days in the year (including approved leave not yet taken,
 * because the balance is deducted at approval). `accruedThisYear` and `openingBalance` are null for
 * a type with no balance (Unpaid).
 */
export type BalanceBreakdownItem = BalanceSummaryItem & {
  usedThisYear: number;
  accruedThisYear: number | null;
  /**
   * Derived, never stored: confirmed + used − accrued, so that opening + accrued − used = confirmed
   * always holds. Negative means the balance moved in a way the ledger does not explain (a hand
   * edit, or a request that crosses New Year and was deducted in full): the page then calls it
   * "Adjustments" instead of "Opening balance".
   */
  openingBalance: number | null;
};

/** Stored amounts have at most 2 decimals, so whole hundredths add up exactly (no float drift). */
const toCents = (value: number | string): number => Math.round(Number(value) * 100);
const fromCents = (cents: number): number => cents / 100;

export function summarizeBreakdown(input: {
  types: readonly LeaveType[];
  balances: readonly Pick<LeaveBalance, "leave_type_id" | "balance">[];
  pending: readonly UsedRange[];
  usedRanges: readonly UsedRange[];
  accrued: readonly AccruedTotal[];
}): BalanceBreakdownItem[] {
  const base = summarizeBalances(input.types, input.balances, input.pending);

  return base.map((item) => {
    const usedThisYear = input.usedRanges
      .filter((r) => r.leave_type_id === item.leaveTypeId)
      .reduce((sum, r) => sum + countWorkingDays(r.start_date, r.end_date), 0);

    if (!item.tracksBalance || item.confirmed === null) {
      return { ...item, usedThisYear, accruedThisYear: null, openingBalance: null };
    }

    const accruedCents = input.accrued
      .filter((a) => a.leave_type_id === item.leaveTypeId)
      .reduce((sum, a) => sum + toCents(a.amount), 0);
    const openingCents = toCents(item.confirmed) + usedThisYear * 100 - accruedCents;

    return {
      ...item,
      usedThisYear,
      accruedThisYear: fromCents(accruedCents),
      openingBalance: fromCents(openingCents),
    };
  });
}
