import type { Sql, TransactionSql } from "postgres";
import { getDb } from "@/lib/db/client";
import type { LeaveBalance, LeaveRequest, LeaveType, User } from "@/lib/db/types";
import { AppError } from "@/lib/errors/app-error";
import {
  overBalanceWarning,
  summarizeBalances,
  type BalanceSummaryItem,
  type LeaveWarning,
} from "@/lib/leave/balance";
import type { CreateLeaveRequestInput } from "@/lib/leave/schemas";
import { countWorkingDays } from "@/lib/leave/working-days";

/**
 * Leave queries for the requester's own data (US-01, US-02). Every query filters by the
 * `userId` argument in SQL, and callers pass the session user's id — never a client value.
 * Dates are selected as text so postgres.js never turns them into timezone-shifting Date objects.
 */

export type LeaveRequestView = Pick<
  LeaveRequest,
  | "id"
  | "leave_type_id"
  | "start_date"
  | "end_date"
  | "reason"
  | "status"
  | "created_at"
  | "decided_at"
  | "decision_note"
> & { working_days: number };

export type CreatedLeaveRequest = { request: LeaveRequestView; warnings: LeaveWarning[] };
export type MySummary = { requests: LeaveRequestView[]; balances: BalanceSummaryItem[] };

type RequestRow = Omit<LeaveRequestView, "working_days">;

export function requireDb(): Sql {
  const sql = getDb();
  if (!sql) throw new AppError("INTERNAL", "The database is not configured.");
  return sql;
}

function toView(row: RequestRow): LeaveRequestView {
  return { ...row, working_days: countWorkingDays(row.start_date, row.end_date) };
}

/** Balance summary for one user: confirmed per type, with pending days shown separately. */
async function loadBalanceSummary(
  sql: Sql | TransactionSql,
  userId: string,
): Promise<BalanceSummaryItem[]> {
  const [types, balances, pending] = await Promise.all([
    // Vacation, Sick, then Unpaid.
    sql<LeaveType[]>`
      select id, name, tracks_balance from public.leave_types
      order by tracks_balance desc, name desc`,
    sql<Pick<LeaveBalance, "leave_type_id" | "balance">[]>`
      select leave_type_id, balance from public.leave_balances where user_id = ${userId}`,
    sql<Pick<LeaveRequest, "leave_type_id" | "start_date" | "end_date">[]>`
      select leave_type_id, start_date::text as start_date, end_date::text as end_date
      from public.leave_requests
      where user_id = ${userId} and status = 'pending' and is_deleted = false`,
  ]);
  return summarizeBalances(types, balances, pending);
}

/** Balances only (confirmed, pending, available per type): for pages that do not list requests. */
export async function getBalanceSummary(sql: Sql, userId: string): Promise<BalanceSummaryItem[]> {
  return loadBalanceSummary(sql, userId);
}

/**
 * US-01. Creates a pending request and its `submitted` audit row in one transaction.
 * The manager is not stored on the request: their queue finds it through users.manager_id,
 * so an org-chart move re-routes pending requests (US-04 AC2).
 */
export async function createLeaveRequest(
  sql: Sql,
  userId: string,
  input: CreateLeaveRequestInput,
): Promise<CreatedLeaveRequest> {
  return sql.begin(async (tx) => {
    const [user] = await tx<Pick<User, "id" | "manager_id">[]>`
      select id, manager_id from public.users where id = ${userId}`;
    if (!user) {
      throw new AppError("NOT_FOUND", "Your account is not set up yet. Ask HR to add you.");
    }
    if (!user.manager_id) {
      throw new AppError(
        "CONFLICT",
        "No approver is assigned to your account, so this request cannot be routed. Ask HR to assign one.",
      );
    }

    const summary = await loadBalanceSummary(tx, userId);
    if (!summary.some((s) => s.leaveTypeId === input.leave_type_id)) {
      throw new AppError("VALIDATION_ERROR", "leave_type_id: unknown leave type");
    }

    // Computed before the insert so the new request does not count against itself.
    const requestedDays = countWorkingDays(input.start_date, input.end_date);
    const warning = overBalanceWarning(summary, input.leave_type_id, requestedDays);

    const [row] = await tx<RequestRow[]>`
      insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
      values (${userId}, ${input.leave_type_id}, ${input.start_date}, ${input.end_date}, ${input.reason})
      returning id, leave_type_id, start_date::text as start_date, end_date::text as end_date,
                reason, status, created_at, decided_at, decision_note`;
    if (!row) throw new AppError("INTERNAL", "The request could not be saved.");

    await tx`
      insert into public.audit_log (leave_request_id, actor_id, action)
      values (${row.id}, ${userId}, 'submitted')`;

    return { request: toView(row), warnings: warning ? [warning] : [] };
  });
}

/** US-02. The user's own non-deleted requests (newest first) and balance summary. */
export async function getMySummary(sql: Sql, userId: string): Promise<MySummary> {
  const [rows, balances] = await Promise.all([
    sql<RequestRow[]>`
      select id, leave_type_id, start_date::text as start_date, end_date::text as end_date,
             reason, status, created_at, decided_at, decision_note
      from public.leave_requests
      where user_id = ${userId} and is_deleted = false
      order by created_at desc
      limit 50`,
    loadBalanceSummary(sql, userId),
  ]);
  return { requests: rows.map(toView), balances };
}
