import type { Sql, TransactionSql } from "postgres";
import { canRequestLeave, EMPLOYEES_ONLY_MESSAGE } from "@/lib/auth/roles";
import { getDb } from "@/lib/db/client";
import type { LeaveBalance, LeaveRequest, LeaveType, User } from "@/lib/db/types";
import { AppError } from "@/lib/errors/app-error";
import {
  overBalanceWarning,
  summarizeBalances,
  type BalanceSummaryItem,
  type LeaveWarning,
} from "@/lib/leave/balance";
import {
  summarizeBreakdown,
  type AccruedTotal,
  type BalanceBreakdownItem,
  type UsedRange,
  type YearBounds,
} from "@/lib/leave/breakdown";
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
> & {
  working_days: number;
  /** True when HR approved this request as an override (TASK-040): an `override_approved` audit row exists. */
  overridden: boolean;
};

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

type SummaryRow = {
  types: LeaveType[];
  balances: Pick<LeaveBalance, "leave_type_id" | "balance">[];
  pending: Pick<LeaveRequest, "leave_type_id" | "start_date" | "end_date">[];
  pending_approvals: number | null;
};

/**
 * Everything a balance summary needs in ONE statement (one pooled connection), as JSON columns.
 * Three separate reads cost three connections per page, and a page that needs the whole pool
 * cascades into stalls when one read hangs (see the 2026-10-18 pool-stalls retro). Balances are
 * cast to text and dates to text so the values match what the separate selects returned.
 * Both user-scoped parts filter by `userId` in SQL (AGENTS.md rule 3); leave types are global.
 * `pending_approvals` counts the caller's direct reports' pending requests and is only computed
 * when `countApprovals` is true (`u.manager_id = userId`, in the query itself); otherwise null.
 */
async function loadSummaryRow(
  sql: Sql | TransactionSql,
  userId: string,
  countApprovals: boolean,
): Promise<SummaryRow> {
  const [row] = await sql<SummaryRow[]>`
    select
      coalesce((
        select json_agg(
          json_build_object('id', t.id, 'name', t.name, 'tracks_balance', t.tracks_balance)
          order by t.tracks_balance desc, t.name desc)
        from public.leave_types t), '[]'::json) as types,
      coalesce((
        select json_agg(json_build_object('leave_type_id', b.leave_type_id, 'balance', b.balance::text))
        from public.leave_balances b where b.user_id = ${userId}), '[]'::json) as balances,
      coalesce((
        select json_agg(json_build_object(
          'leave_type_id', r.leave_type_id,
          'start_date', r.start_date::text,
          'end_date', r.end_date::text))
        from public.leave_requests r
        where r.user_id = ${userId} and r.status = 'pending' and r.is_deleted = false), '[]'::json) as pending,
      case when ${countApprovals}::boolean then (
        select count(*)::int
        from public.leave_requests q
        join public.users u on u.id = q.user_id
        where u.manager_id = ${userId} and q.status = 'pending' and q.is_deleted = false
      ) end as pending_approvals`;
  return row ?? { types: [], balances: [], pending: [], pending_approvals: null };
}

/** Balance summary for one user: confirmed per type, with pending days shown separately. */
async function loadBalanceSummary(
  sql: Sql | TransactionSql,
  userId: string,
): Promise<BalanceSummaryItem[]> {
  const { types, balances, pending } = await loadSummaryRow(sql, userId, false);
  return summarizeBalances(types, balances, pending);
}

/** Balances only (confirmed, pending, available per type): for pages that do not list requests. */
export async function getBalanceSummary(sql: Sql, userId: string): Promise<BalanceSummaryItem[]> {
  return loadBalanceSummary(sql, userId);
}

/**
 * The dashboard's summary cards in one statement: the user's balances and, for approvers, how
 * many requests from their direct reports wait for them. Replaces a balances read plus loading
 * the whole team queue only to count it.
 */
export async function getDashboardSummary(
  sql: Sql,
  userId: string,
  countApprovals: boolean,
): Promise<{ balances: BalanceSummaryItem[]; pendingApprovals: number | null }> {
  const { types, balances, pending, pending_approvals } = await loadSummaryRow(
    sql,
    userId,
    countApprovals,
  );
  return {
    balances: summarizeBalances(types, balances, pending),
    pendingApprovals: countApprovals ? (pending_approvals ?? 0) : null,
  };
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
    const [user] = await tx<Pick<User, "id" | "manager_id" | "role">[]>`
      select id, manager_id, role from public.users where id = ${userId}`;
    if (!user) {
      throw new AppError("NOT_FOUND", "Your account is not set up yet. Ask HR to add you.");
    }
    // EPIC-10: the role comes from the users row, not the caller, so a stale session cannot slip
    // through. Checked before the approver, so a top-level HR admin is told why, not "no approver".
    if (!canRequestLeave(user.role)) {
      throw new AppError("FORBIDDEN", EMPLOYEES_ONLY_MESSAGE);
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
                reason, status, created_at, decided_at, decision_note,
                false as overridden`;
    if (!row) throw new AppError("INTERNAL", "The request could not be saved.");

    await tx`
      insert into public.audit_log (leave_request_id, actor_id, action)
      values (${row.id}, ${userId}, 'submitted')`;

    return { request: toView(row), warnings: warning ? [warning] : [] };
  });
}

/** The user's own non-deleted requests, newest first (one statement). Scoped by `userId` in SQL. */
function listMyRequests(sql: Sql, userId: string): Promise<RequestRow[]> {
  return sql<RequestRow[]>`
    select r.id, r.leave_type_id, r.start_date::text as start_date, r.end_date::text as end_date,
           r.reason, r.status, r.created_at, r.decided_at, r.decision_note,
           exists (
             select 1 from public.audit_log a
             where a.leave_request_id = r.id and a.action = 'override_approved'
           ) as overridden
    from public.leave_requests r
    where r.user_id = ${userId} and r.is_deleted = false
    order by r.created_at desc
    limit 50`;
}

/** US-02. The user's own non-deleted requests (newest first) and balance summary. */
export async function getMySummary(sql: Sql, userId: string): Promise<MySummary> {
  const [rows, balances] = await Promise.all([
    listMyRequests(sql, userId),
    loadBalanceSummary(sql, userId),
  ]);
  return { requests: rows.map(toView), balances };
}

type BreakdownRow = {
  types: LeaveType[];
  balances: Pick<LeaveBalance, "leave_type_id" | "balance">[];
  pending: UsedRange[];
  used: UsedRange[] | null;
  accrued: AccruedTotal[] | null;
};

/**
 * The My Balance page's figures in ONE statement (one pooled connection). It repeats the three
 * subselects of `loadSummaryRow` on purpose: that statement runs on the dashboard, on Request
 * Leave and inside the submit transaction, and this page's extra data must not be able to change
 * any of them. Every user-scoped part filters by `userId` in SQL (AGENTS.md rule 3).
 * - `used`: this user's APPROVED, non-deleted requests that overlap the year, already clipped to
 *   it (`greatest`/`least`); the weekdays are counted in TypeScript by `countWorkingDays`, the
 *   same function that counts pending days, so there is one definition of a working day.
 * - `accrued`: this user's ledger credits for the year's months, summed in SQL (`numeric`).
 */
async function loadBreakdownRow(
  sql: Sql,
  userId: string,
  { from, to }: YearBounds,
): Promise<BreakdownRow> {
  const [row] = await sql<BreakdownRow[]>`
    select
      coalesce((
        select json_agg(
          json_build_object('id', t.id, 'name', t.name, 'tracks_balance', t.tracks_balance)
          order by t.tracks_balance desc, t.name desc)
        from public.leave_types t), '[]'::json) as types,
      coalesce((
        select json_agg(json_build_object('leave_type_id', b.leave_type_id, 'balance', b.balance::text))
        from public.leave_balances b where b.user_id = ${userId}), '[]'::json) as balances,
      coalesce((
        select json_agg(json_build_object(
          'leave_type_id', r.leave_type_id,
          'start_date', r.start_date::text,
          'end_date', r.end_date::text))
        from public.leave_requests r
        where r.user_id = ${userId} and r.status = 'pending' and r.is_deleted = false), '[]'::json) as pending,
      coalesce((
        select json_agg(json_build_object(
          'leave_type_id', u.leave_type_id,
          'start_date', greatest(u.start_date, ${from}::date)::text,
          'end_date', least(u.end_date, ${to}::date)::text))
        from public.leave_requests u
        where u.user_id = ${userId} and u.status = 'approved' and u.is_deleted = false
          and u.start_date <= ${to}::date and u.end_date >= ${from}::date), '[]'::json) as used,
      coalesce((
        select json_agg(json_build_object('leave_type_id', a.leave_type_id, 'amount', a.total::text))
        from (
          select l.leave_type_id, sum(l.amount) as total
          from public.accrual_ledger l
          where l.user_id = ${userId} and l.period >= ${from}::date and l.period <= ${to}::date
          group by l.leave_type_id) a), '[]'::json) as accrued`;
  return row ?? { types: [], balances: [], pending: [], used: [], accrued: [] };
}

export type BalancePage = { requests: LeaveRequestView[]; balances: BalanceBreakdownItem[] };

/**
 * US-02, My Balance page: the user's requests and, per leave type, how the days are made up
 * (opening, accrued and used this year, pending, available). Two statements run in parallel.
 * `getMySummary` is left as it is for `GET /api/leave-requests`, so that payload does not change.
 */
export async function getBalancePage(
  sql: Sql,
  userId: string,
  year: YearBounds,
): Promise<BalancePage> {
  const [rows, row] = await Promise.all([
    listMyRequests(sql, userId),
    loadBreakdownRow(sql, userId, year),
  ]);
  return {
    requests: rows.map(toView),
    balances: summarizeBreakdown({
      types: row.types,
      balances: row.balances,
      pending: row.pending,
      usedRanges: row.used ?? [],
      accrued: row.accrued ?? [],
    }),
  };
}
