import type { Sql } from "postgres";
import type { LeaveBalance, LeaveStatus, LeaveType, UserRole } from "@/lib/db/types";
import { summarizeBalances, type BalanceSummaryItem } from "@/lib/leave/balance";
import type { UsedRange } from "@/lib/leave/breakdown";
import type { IsoDate } from "@/lib/leave/calendar-layout";

/**
 * US-12. A manager's direct reports with their current leave status, in ONE statement (one pooled
 * connection). Scope is in the SQL (AGENTS.md rule 3 and BR-02): `u.manager_id = ${managerId}` is
 * part of the query, so the caller is never in their own roster and another team never is either.
 * Nothing is fetched broadly and filtered in TypeScript, and the caller's id is the session user's,
 * never a value from the client.
 */

export type RosterStatus =
  { kind: "out_today" } | { kind: "next_leave"; start: IsoDate } | { kind: "none" };

export type RosterMember = {
  id: string;
  name: string;
  role: UserRole;
  /** Approved leave only: out today, else the start of the next approved leave, else nothing planned. */
  status: RosterStatus;
  /** Their own pending requests, waiting for the manager. */
  pendingCount: number;
  /** Balance-tracked types only (Vacation, Sick), in My Balance order, from the same function. */
  balances: BalanceSummaryItem[];
  /** The most recently submitted request that is not deleted, with its status. */
  lastRequest: { leaveTypeName: string; status: LeaveStatus } | null;
};

type RosterRow = {
  id: string;
  name: string;
  role: UserRole;
  out_today: boolean;
  next_start: string | null;
  pending_count: number;
  last_request: { leave_type_name: string; status: LeaveStatus } | null;
  types: LeaveType[];
  balances: Pick<LeaveBalance, "leave_type_id" | "balance">[];
  pending: UsedRange[];
};

/** `today` is the ISO date in the app time zone (`todayIn(APP_TIMEZONE, now)`). */
export async function getTeamRoster(
  sql: Sql,
  managerId: string,
  today: IsoDate,
): Promise<RosterMember[]> {
  const rows = await sql<RosterRow[]>`
    select u.id, u.name, u.role,
      exists (
        select 1 from public.leave_requests r
        where r.user_id = u.id and r.status = 'approved' and r.is_deleted = false
          and r.start_date <= ${today}::date and r.end_date >= ${today}::date
      ) as out_today,
      (
        select min(r.start_date)::text from public.leave_requests r
        where r.user_id = u.id and r.status = 'approved' and r.is_deleted = false
          and r.start_date > ${today}::date
      ) as next_start,
      (
        select count(*)::int from public.leave_requests r
        where r.user_id = u.id and r.status = 'pending' and r.is_deleted = false
      ) as pending_count,
      (
        select json_build_object('leave_type_name', lt.name, 'status', r.status)
        from public.leave_requests r
        join public.leave_types lt on lt.id = r.leave_type_id
        where r.user_id = u.id and r.is_deleted = false
        order by r.created_at desc, r.id desc
        limit 1
      ) as last_request,
      coalesce((
        select json_agg(
          json_build_object('id', t.id, 'name', t.name, 'tracks_balance', t.tracks_balance)
          order by t.tracks_balance desc, t.name desc)
        from public.leave_types t), '[]'::json) as types,
      coalesce((
        select json_agg(json_build_object('leave_type_id', b.leave_type_id, 'balance', b.balance::text))
        from public.leave_balances b where b.user_id = u.id), '[]'::json) as balances,
      coalesce((
        select json_agg(json_build_object(
          'leave_type_id', r.leave_type_id,
          'start_date', r.start_date::text,
          'end_date', r.end_date::text))
        from public.leave_requests r
        where r.user_id = u.id and r.status = 'pending' and r.is_deleted = false), '[]'::json) as pending
    from public.users u
    where u.manager_id = ${managerId}
    order by u.name, u.id`;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    status: row.out_today
      ? { kind: "out_today" }
      : row.next_start
        ? { kind: "next_leave", start: row.next_start }
        : { kind: "none" },
    pendingCount: row.pending_count,
    balances: summarizeBalances(row.types, row.balances, row.pending).filter(
      (b) => b.tracksBalance,
    ),
    lastRequest: row.last_request
      ? { leaveTypeName: row.last_request.leave_type_name, status: row.last_request.status }
      : null,
  }));
}
