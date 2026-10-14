import type { Sql } from "postgres";
import type { LeaveRequest } from "@/lib/db/types";
import { AppError } from "@/lib/errors/app-error";
import type { DecisionInput } from "@/lib/leave/schemas";
import { countWorkingDays } from "@/lib/leave/working-days";

/**
 * TASK-014 (US-03). Approve or reject one pending request from one of the caller's direct
 * reports. Scope, the status guard and the balance rule all live in SQL inside one
 * transaction, so a decision can never be half-applied or applied twice.
 */

export type DecidedRequestView = Pick<
  LeaveRequest,
  | "id"
  | "leave_type_id"
  | "start_date"
  | "end_date"
  | "reason"
  | "status"
  | "decided_by"
  | "decision_note"
> & { decided_at: Date };

export type DecisionResult = {
  request: DecidedRequestView;
  /** The employee's balance after an approval of a balance-tracked type; null otherwise. */
  balance: { leaveTypeId: string; balance: number } | null;
};

type LockedRequest = Pick<LeaveRequest, "id" | "user_id" | "leave_type_id" | "status"> & {
  start_date: string;
  end_date: string;
  tracks_balance: boolean;
};

export async function decideLeaveRequest(
  sql: Sql,
  deciderId: string,
  requestId: string,
  input: DecisionInput,
): Promise<DecisionResult> {
  return sql.begin(async (tx) => {
    // Scope is in the query (AGENTS.md rule 3): only a direct report's request is found, and the
    // row lock makes two simultaneous decisions on the same request take turns. A missing,
    // deleted or other-team request all look the same to the caller, so ids cannot be probed.
    const [req] = await tx<LockedRequest[]>`
      select r.id, r.user_id, r.leave_type_id, r.status,
             r.start_date::text as start_date, r.end_date::text as end_date,
             lt.tracks_balance
      from public.leave_requests r
      join public.users u on u.id = r.user_id
      join public.leave_types lt on lt.id = r.leave_type_id
      where r.id = ${requestId} and u.manager_id = ${deciderId} and r.is_deleted = false
      for update of r`;
    if (!req) {
      throw new AppError("FORBIDDEN", "This request is not from one of your direct reports.");
    }
    if (req.status !== "pending") {
      throw new AppError("CONFLICT", `This request has already been ${req.status}.`);
    }

    let balanceAfter: DecisionResult["balance"] = null;

    // Only an approval of a balance-tracked type touches a balance, and only that request's own
    // leave type. Unpaid (tracks_balance = false) never reads or writes leave_balances.
    if (input.decision === "approve" && req.tracks_balance) {
      const days = countWorkingDays(req.start_date, req.end_date);
      const [updated] = await tx<{ balance: string }[]>`
        update public.leave_balances
        set balance = balance - ${days}, updated_at = now()
        where user_id = ${req.user_id} and leave_type_id = ${req.leave_type_id}
          and balance >= ${days}
        returning balance`;

      if (!updated) {
        // Nothing was changed. Say why; the transaction rolls back when this throws.
        const [current] = await tx<{ balance: string }[]>`
          select balance from public.leave_balances
          where user_id = ${req.user_id} and leave_type_id = ${req.leave_type_id}`;
        if (!current) {
          throw new AppError(
            "CONFLICT",
            "There is no balance record for this leave type, so it cannot be approved. Ask HR to set it up.",
          );
        }
        const available = Number(current.balance);
        throw new AppError(
          "CONFLICT",
          `Insufficient balance: this request is ${days} working day${days === 1 ? "" : "s"} but only ${available} ${available === 1 ? "is" : "are"} available. An HR override is not available yet; you can reject the request instead.`,
        );
      }
      balanceAfter = { leaveTypeId: req.leave_type_id, balance: Number(updated.balance) };
    }

    const status = input.decision === "approve" ? "approved" : "rejected";
    const note = input.decision === "reject" ? input.note : null;

    const [row] = await tx<DecidedRequestView[]>`
      update public.leave_requests
      set status = ${status}, decided_by = ${deciderId}, decided_at = now(), decision_note = ${note}
      where id = ${requestId} and status = 'pending'
      returning id, leave_type_id, start_date::text as start_date, end_date::text as end_date,
                reason, status, decided_by, decided_at, decision_note`;
    if (!row) throw new AppError("CONFLICT", "This request has already been decided.");

    // BR-04: every decision is recorded in the same transaction.
    await tx`
      insert into public.audit_log (leave_request_id, actor_id, action)
      values (${requestId}, ${deciderId}, ${status})`;

    return { request: row, balance: balanceAfter };
  });
}
