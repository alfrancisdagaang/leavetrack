import type { LeaveBalance, LeaveRequest, LeaveType } from "@/lib/db/types";
import { countWorkingDays } from "@/lib/leave/working-days";

/** One row of the balance page / GET payload. Days are working days. */
export type BalanceSummaryItem = {
  leaveTypeId: string;
  leaveTypeName: string;
  tracksBalance: boolean;
  /** Balance as of the last accrual run. null when the type has no balance (Unpaid). */
  confirmed: number | null;
  /** Working days in this user's pending requests. Shown separately, never deducted from confirmed. */
  pending: number;
  /** confirmed − pending. null when the type has no balance. */
  available: number | null;
};

export type LeaveWarning = {
  code: "OVER_BALANCE";
  message: string;
  requestedDays: number;
  availableDays: number;
};

type PendingRange = Pick<LeaveRequest, "leave_type_id" | "start_date" | "end_date">;

/**
 * Pending days are derived from the user's own pending requests (nothing stores them).
 * A balance-tracked type with no balance row counts as 0.
 */
export function summarizeBalances(
  types: readonly LeaveType[],
  balances: readonly Pick<LeaveBalance, "leave_type_id" | "balance">[],
  pending: readonly PendingRange[],
): BalanceSummaryItem[] {
  return types.map((type) => {
    const pendingDays = pending
      .filter((r) => r.leave_type_id === type.id)
      .reduce((sum, r) => sum + countWorkingDays(r.start_date, r.end_date), 0);

    if (!type.tracks_balance) {
      return {
        leaveTypeId: type.id,
        leaveTypeName: type.name,
        tracksBalance: false,
        confirmed: null,
        pending: pendingDays,
        available: null,
      };
    }

    const row = balances.find((b) => b.leave_type_id === type.id);
    const confirmed = row ? Number(row.balance) : 0;
    return {
      leaveTypeId: type.id,
      leaveTypeName: type.name,
      tracksBalance: true,
      confirmed,
      pending: pendingDays,
      available: confirmed - pendingDays,
    };
  });
}

/**
 * US-01 AC3 — warn, never block. Types without a balance (Unpaid) never warn.
 * `available` already has this user's other pending requests subtracted.
 */
export function overBalanceWarning(
  summary: readonly BalanceSummaryItem[],
  leaveTypeId: string,
  requestedDays: number,
): LeaveWarning | null {
  const item = summary.find((s) => s.leaveTypeId === leaveTypeId);
  if (!item || !item.tracksBalance || item.available === null) return null;
  if (requestedDays <= item.available) return null;

  const availableDays = Math.max(item.available, 0);
  return {
    code: "OVER_BALANCE",
    message: `This request is ${requestedDays} working day${requestedDays === 1 ? "" : "s"} but only ${availableDays} ${item.leaveTypeName} day${availableDays === 1 ? " is" : "s are"} available. You can still submit it for HR override.`,
    requestedDays,
    availableDays,
  };
}
