import type { Sql } from "postgres";
import type { LeaveBalance, LeaveStatus, LeaveType, UserRole } from "@/lib/db/types";
import { summarizeBalances, type BalanceSummaryItem } from "@/lib/leave/balance";
import { yearBounds, type UsedRange } from "@/lib/leave/breakdown";
import type { IsoDate } from "@/lib/leave/calendar-layout";
import { checkOverBalance, type BalanceCheck } from "@/lib/leave/over-balance";
import { MEMBER_PAGE_SIZE, type TeamMemberQuery } from "@/lib/leave/schemas";
import { countWorkingDays } from "@/lib/leave/working-days";

/**
 * US-13. One direct report's balances and requests, for a manager, in ONE statement (one pooled
 * connection). The person comes from the page address and is NEVER trusted: a `member` CTE finds them
 * only if `u.manager_id = ${managerId}` (AGENTS.md rule 3, BR-02), and every other part of the
 * statement reads from that CTE. So another team's member, a missing person, a deleted one, the
 * caller's own id and a malformed one all produce the same empty result, and a change of manager
 * between two requests cannot leak anything. The caller's id is the session user's.
 *
 * Privacy (US-13 AC4): the employee's free-text reason may hold medical details. It is selected only
 * for a PENDING request, in the SQL itself (`case when status = 'pending' then reason end`), so it
 * can never reach a decided row, whatever the page does with it.
 */

export type MemberRequest = {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: IsoDate;
  endDate: IsoDate;
  workingDays: number;
  status: LeaveStatus;
  /** The manager's own note on a rejection. */
  decisionNote: string | null;
  /** The employee's reason, for a PENDING request only; always null once it is decided. */
  reason: string | null;
  /**
   * For a PENDING request: whether the manager can approve it (`ok`), only reject it because HR can
   * override it (`over`), or needs the balance fixed first. `ok` for every decided request.
   */
  balanceCheck: BalanceCheck;
  /** True when HR approved it as an override (an `override_approved` audit row exists). */
  overridden: boolean;
};

export type TeamMemberPage = {
  member: { id: string; name: string; role: UserRole };
  /** Balance-tracked types only (Vacation, Sick), from the same function My Balance uses. */
  balances: BalanceSummaryItem[];
  /** Every leave type, for the filter. */
  leaveTypes: { id: string; name: string }[];
  /** This page of requests (25), newest start date first. */
  requests: MemberRequest[];
  /** How many requests match the filters, across all pages. */
  total: number;
};

type RequestRow = {
  id: string;
  leave_type_id: string;
  leave_type_name: string;
  tracks_balance: boolean;
  start_date: IsoDate;
  end_date: IsoDate;
  status: LeaveStatus;
  decision_note: string | null;
  reason: string | null;
  overridden: boolean;
};

type MemberRow = {
  member: { id: string; name: string; role: UserRole } | null;
  types: LeaveType[];
  balances: Pick<LeaveBalance, "leave_type_id" | "balance">[];
  pending: UsedRange[];
  total: number;
  requests: RequestRow[];
};

/** Null means "not found" for every reason alike (see above). */
export async function getTeamMemberPage(
  sql: Sql,
  managerId: string,
  memberId: string,
  query: TeamMemberQuery,
): Promise<TeamMemberPage | null> {
  const { from, to } = yearBounds(`${query.year}-06-15`);
  const type = query.leaveTypeId ?? null;
  const status = query.status ?? null;
  const offset = (query.page - 1) * MEMBER_PAGE_SIZE;

  const [row] = await sql<MemberRow[]>`
    with member as (
      select u.id, u.name, u.role
      from public.users u
      where u.id = ${memberId} and u.manager_id = ${managerId}
    ), filtered as (
      select r.id, r.leave_type_id, lt.name as leave_type_name, lt.tracks_balance,
             r.start_date, r.end_date, r.status, r.decision_note,
             case when r.status = 'pending' then r.reason end as reason
      from public.leave_requests r
      join member m on m.id = r.user_id
      join public.leave_types lt on lt.id = r.leave_type_id
      where r.is_deleted = false
        and (${type}::uuid is null or r.leave_type_id = ${type}::uuid)
        and (${status}::public.leave_status is null or r.status = ${status}::public.leave_status)
        and r.start_date <= ${to}::date and r.end_date >= ${from}::date
    )
    select
      (select json_build_object('id', m.id, 'name', m.name, 'role', m.role) from member m) as member,
      coalesce((
        select json_agg(
          json_build_object('id', t.id, 'name', t.name, 'tracks_balance', t.tracks_balance)
          order by t.tracks_balance desc, t.name desc)
        from public.leave_types t), '[]'::json) as types,
      coalesce((
        select json_agg(json_build_object('leave_type_id', b.leave_type_id, 'balance', b.balance::text))
        from public.leave_balances b join member m on m.id = b.user_id), '[]'::json) as balances,
      coalesce((
        select json_agg(json_build_object(
          'leave_type_id', r.leave_type_id,
          'start_date', r.start_date::text,
          'end_date', r.end_date::text))
        from public.leave_requests r join member m on m.id = r.user_id
        where r.status = 'pending' and r.is_deleted = false), '[]'::json) as pending,
      (select count(*)::int from filtered) as total,
      coalesce((
        select json_agg(json_build_object(
          'id', p.id, 'leave_type_id', p.leave_type_id, 'leave_type_name', p.leave_type_name,
          'tracks_balance', p.tracks_balance, 'start_date', p.start_date::text,
          'end_date', p.end_date::text, 'status', p.status, 'decision_note', p.decision_note,
          'reason', p.reason,
          'overridden', exists (
            select 1 from public.audit_log a
            where a.leave_request_id = p.id and a.action = 'override_approved'))
          order by p.start_date desc, p.id desc)
        from (
          select * from filtered order by start_date desc, id desc
          limit ${MEMBER_PAGE_SIZE}::int offset ${offset}::int
        ) p), '[]'::json) as requests`;

  if (!row?.member) return null;

  const confirmedByType = new Map(row.balances.map((b) => [b.leave_type_id, Number(b.balance)]));
  const requests: MemberRequest[] = row.requests.map((r) => {
    const workingDays = countWorkingDays(r.start_date, r.end_date);
    const confirmed = confirmedByType.get(r.leave_type_id);
    return {
      id: r.id,
      leaveTypeId: r.leave_type_id,
      leaveTypeName: r.leave_type_name,
      startDate: r.start_date,
      endDate: r.end_date,
      workingDays,
      status: r.status,
      decisionNote: r.decision_note,
      reason: r.reason,
      // Same rule as the approvals queue and the HR override queue (one shared function). Only a
      // pending request can be decided, so every other status is `ok`.
      balanceCheck:
        r.status === "pending"
          ? checkOverBalance({
              tracksBalance: r.tracks_balance,
              balance: confirmed ?? null,
              days: workingDays,
            })
          : { kind: "ok" },
      overridden: r.overridden,
    };
  });

  return {
    member: row.member,
    balances: summarizeBalances(row.types, row.balances, row.pending).filter(
      (b) => b.tracksBalance,
    ),
    leaveTypes: row.types.map((t) => ({ id: t.id, name: t.name })),
    requests,
    total: row.total,
  };
}
