import type { Sql } from "postgres";
import type { LeaveRequest } from "@/lib/db/types";
import { AppError } from "@/lib/errors/app-error";
import type { DecidedRequestView } from "@/lib/leave/decide";
import type { DecisionInput } from "@/lib/leave/schemas";
import { countWorkingDays } from "@/lib/leave/working-days";

/**
 * TASK-038 (PRD US-01 AC3). An HR Admin overrides, or rejects, one PENDING request that asks for
 * more days than the employee has. Everything is decided in SQL inside one transaction, so the
 * balance change, the decision and the audit row can never be half-applied or applied twice.
 *
 * DELIBERATE EXCEPTION to AGENTS.md rule 3 (manager scoping): this is not scoped to a team. The
 * scope is the role (the route's `assertRole("hr_admin")`), "not the caller's own request" and the
 * over-balance condition, all in the lookup and guards below. The caller id is the session user,
 * never a client value.
 */

export type OverrideResult = {
  request: DecidedRequestView;
  /** The balance after an approval (always 0: the override uses up what the employee had); null on a rejection. */
  balance: { leaveTypeId: string; balance: number } | null;
  /** Days the request was short by, recorded in the audit row; null on a rejection. */
  shortfall: string | null;
};

type LockedRequest = Pick<LeaveRequest, "id" | "user_id" | "leave_type_id" | "status"> & {
  start_date: string;
  end_date: string;
  tracks_balance: boolean;
};

const days = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;

export async function overrideLeaveRequest(
  sql: Sql,
  deciderId: string,
  requestId: string,
  input: DecisionInput,
): Promise<OverrideResult> {
  return sql.begin(async (tx) => {
    // The row lock makes two simultaneous decisions on the same request take turns. A missing,
    // deleted or own request all look the same to the caller, so ids cannot be probed.
    const [req] = await tx<LockedRequest[]>`
      select r.id, r.user_id, r.leave_type_id, r.status,
             r.start_date::text as start_date, r.end_date::text as end_date,
             lt.tracks_balance
      from public.leave_requests r
      join public.leave_types lt on lt.id = r.leave_type_id
      where r.id = ${requestId} and r.is_deleted = false and r.user_id <> ${deciderId}
      for update of r`;
    if (!req) {
      throw new AppError("FORBIDDEN", "This request is not available for an HR override.");
    }
    if (req.status !== "pending") {
      throw new AppError("CONFLICT", `This request has already been ${req.status}.`);
    }
    if (!req.tracks_balance) {
      throw new AppError(
        "CONFLICT",
        "This leave type has no balance, so there is nothing to override.",
      );
    }

    // Lock the balance row too, so two overrides cannot read the same balance_before.
    const [current] = await tx<{ balance: string }[]>`
      select balance::text as balance from public.leave_balances
      where user_id = ${req.user_id} and leave_type_id = ${req.leave_type_id}
      for update`;
    if (!current) {
      throw new AppError(
        "CONFLICT",
        "There is no balance record for this leave type, so it cannot be overridden. Set it up first.",
      );
    }
    const requested = countWorkingDays(req.start_date, req.end_date);
    const available = Number(current.balance);
    if (available < 0) {
      throw new AppError(
        "CONFLICT",
        `This balance is negative (${current.balance}), so it cannot be overridden. Correct the balance first.`,
      );
    }
    if (available >= requested) {
      throw new AppError(
        "CONFLICT",
        `This request is ${days(requested)} and ${available} ${available === 1 ? "is" : "are"} available, so it is within balance. Its manager decides it.`,
      );
    }

    if (input.decision === "reject") {
      const [row] = await tx<DecidedRequestView[]>`
        update public.leave_requests
        set status = 'rejected', decided_by = ${deciderId}, decided_at = now(),
            decision_note = ${input.note}
        where id = ${requestId} and status = 'pending'
        returning id, leave_type_id, start_date::text as start_date, end_date::text as end_date,
                  reason, status, decided_by, decided_at, decision_note`;
      if (!row) throw new AppError("CONFLICT", "This request has already been decided.");

      // BR-04: every decision is recorded in the same transaction.
      await tx`
        insert into public.audit_log (leave_request_id, actor_id, action)
        values (${requestId}, ${deciderId}, 'rejected')`;
      return { request: row, balance: null, shortfall: null };
    }

    // Approve: only this request's own leave type is touched, and it is used up.
    await tx`
      update public.leave_balances
      set balance = 0, updated_at = now()
      where user_id = ${req.user_id} and leave_type_id = ${req.leave_type_id}`;

    const [row] = await tx<DecidedRequestView[]>`
      update public.leave_requests
      set status = 'approved', decided_by = ${deciderId}, decided_at = now(), decision_note = null
      where id = ${requestId} and status = 'pending'
      returning id, leave_type_id, start_date::text as start_date, end_date::text as end_date,
                reason, status, decided_by, decided_at, decision_note`;
    if (!row) throw new AppError("CONFLICT", "This request has already been decided.");

    // The shortfall is worked out in SQL numeric, never in JS floating point.
    const [audit] = await tx<{ shortfall: string }[]>`
      insert into public.audit_log
        (leave_request_id, actor_id, action, days_requested, balance_before, shortfall)
      values (${requestId}, ${deciderId}, 'override_approved', ${requested},
              ${current.balance}::numeric, ${requested}::numeric - ${current.balance}::numeric)
      returning shortfall::text as shortfall`;

    return {
      request: row,
      balance: { leaveTypeId: req.leave_type_id, balance: 0 },
      shortfall: audit?.shortfall ?? null,
    };
  });
}
