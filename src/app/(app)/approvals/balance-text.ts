import type { BalanceCheck } from "@/lib/leave/over-balance";
import { formatDays } from "./team/team-format";

/**
 * TASK-040. What a manager is told about a pending request whose balance does not allow approving
 * it. Written as text (never colour alone). Null for `ok`: the request has Approve and Reject as
 * usual. For anything else the manager can only reject: `over` is waiting for an HR override;
 * `no_balance_record` and `negative` need the balance fixed first, and HR cannot override those.
 */
export type BalanceText = { headline: string; detail: string };

const workingDays = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;

export function balanceText(
  check: BalanceCheck,
  days: number,
  leaveTypeName: string,
): BalanceText | null {
  switch (check.kind) {
    case "ok":
      return null;
    case "over":
      return {
        headline: `Over balance by ${formatDays(check.shortfall)}`,
        detail: `Waiting for HR override. This request is ${workingDays(days)} and the ${leaveTypeName} balance is ${formatDays(check.balance)}. HR can approve it as an override; you can reject it.`,
      };
    case "no_balance_record":
      return {
        headline: "No balance record",
        detail: `There is no balance record for this leave type, so it cannot be approved. Ask HR to set it up, or reject the request.`,
      };
    case "negative":
      return {
        headline: "Balance is negative",
        detail: `The ${leaveTypeName} balance is ${formatDays(check.balance)}, so it cannot be approved. Ask HR to correct it, or reject the request.`,
      };
  }
}
