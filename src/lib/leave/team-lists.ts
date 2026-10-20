import type { Sql } from "postgres";
import { likePattern } from "@/lib/leave/audit-list";
import { shownPage, type ListPage } from "@/lib/leave/list-query";
import { checkOverBalance } from "@/lib/leave/over-balance";
import type { DecidedTeamRequestView, TeamRequestView } from "@/lib/leave/team";
import type { TeamQueueQuery } from "@/lib/leave/team-queue-schema";

/**
 * Team Approvals at scale (EPIC-14): one page of a manager's team's requests, filtered, sorted and paged
 * in SQL. The scope is the same as `team.ts` (AGENTS.md rule 3): `u.manager_id = ${managerId}` is in every
 * statement, the manager must really be a `manager` (checked in the SQL), and nothing is fetched broadly
 * and filtered in TypeScript. The signed-in user's id comes from the session, never from the address.
 *
 * The filters, the order and the page size are bound values; the order is a `CASE` over the validated
 * `sort` and `dir` (never text), with name, then date, then id as the tie-break so paging is stable. The
 * total is counted before the cut and the page is clamped in SQL. Working days are counted in SQL exactly
 * as the HR queue does, and the over-balance state mirrors `checkOverBalance` (a gated test compares them
 * over every case), so "can approve", "waiting for HR" and "needs a balance fix" mean here what they mean
 * on every other page and in the decision route.
 */

export type TeamPendingSummary = {
  pending: number;
  /** The manager can approve these now. */
  canApprove: number;
  /** Over balance (only HR can override) or blocked (no balance record, or a negative balance). */
  cannotApprove: number;
  /** Whole days since the oldest pending request was submitted; null when nothing is pending. */
  oldestDays: number | null;
};

type PendingRaw = Omit<TeamRequestView, "balance" | "balanceCheck" | "created_at"> & {
  created_at: string;
  balance: string | null;
};

export async function getTeamQueuePage(
  sql: Sql,
  { managerId, ...query }: TeamQueueQuery & { managerId: string },
): Promise<ListPage<TeamRequestView, TeamPendingSummary>> {
  const pattern = query.q ? likePattern(query.q) : null;
  const asked = (query.page - 1) * query.per;
  const { per, sort, dir } = query;
  const type = query.type ?? null;
  const status = query.status ?? null;
  const from = query.from ?? null;
  const to = query.to ?? null;
  const [raw] = await sql<{ total: number; summary: TeamPendingSummary; rows: PendingRaw[] }[]>`
    with me as (
      select 1 as ok from public.users m where m.id = ${managerId}::uuid and m.role = 'manager'
    ),
    base as (
      select r.id, u.name as employee_name, r.leave_type_id, lt.name as leave_type_name,
             lt.tracks_balance, r.start_date, r.end_date, r.reason, r.status, r.created_at,
             lb.balance, d.days as working_days,
             case when not lt.tracks_balance then 'ok'
                  when lb.balance is null then 'blocked'
                  when lb.balance < 0 then 'blocked'
                  when d.days > lb.balance then 'over'
                  else 'ok' end as state
      from public.leave_requests r
      join public.users u on u.id = r.user_id
      join public.leave_types lt on lt.id = r.leave_type_id
      left join public.leave_balances lb
        on lb.user_id = r.user_id and lb.leave_type_id = r.leave_type_id
      cross join lateral (
        select count(*)::int as days
        from generate_series(r.start_date::timestamp, r.end_date::timestamp, interval '1 day') g
        where extract(isodow from g) < 6
      ) d
      where exists (select 1 from me)
        and u.manager_id = ${managerId}::uuid
        and r.status = 'pending' and r.is_deleted = false
    ),
    f as (
      select b.* from base b
      where (${pattern}::text is null or b.employee_name ilike ${pattern}::text)
        and (${type}::uuid is null or b.leave_type_id = ${type}::uuid)
        and (${status}::text is null or b.state = ${status}::text)
        and (${from}::date is null or b.end_date >= ${from}::date)
        and (${to}::date is null or b.start_date <= ${to}::date)
    ),
    counts as (select count(*)::int as total from f),
    summary as (
      select count(*)::int as pending,
             count(*) filter (where state = 'ok')::int as can_approve,
             count(*) filter (where state <> 'ok')::int as cannot_approve,
             floor(extract(epoch from (now() - min(created_at))) / 86400)::int as oldest_days
      from base
    ),
    ordered as (
      select f.*,
             row_number() over (
               order by
                 case when ${sort} = 'created' and ${dir} = 'asc' then f.created_at end asc,
                 case when ${sort} = 'created' and ${dir} = 'desc' then f.created_at end desc,
                 case when ${sort} = 'start' and ${dir} = 'asc' then f.start_date end asc,
                 case when ${sort} = 'start' and ${dir} = 'desc' then f.start_date end desc,
                 case when ${sort} = 'name' and ${dir} = 'asc' then f.employee_name end asc,
                 case when ${sort} = 'name' and ${dir} = 'desc' then f.employee_name end desc,
                 case when ${sort} = 'days' and ${dir} = 'asc' then f.working_days end asc,
                 case when ${sort} = 'days' and ${dir} = 'desc' then f.working_days end desc,
                 f.created_at, f.id) as rn
      from f
    ),
    kept as (
      select o.* from ordered o
      order by o.rn
      offset (select least(${asked}::int,
                           greatest(0, (ceil(total / ${per}::numeric)::int - 1) * ${per}::int))
              from counts)
      limit ${per}::int
    )
    select c.total,
           json_build_object('pending', s.pending, 'canApprove', s.can_approve,
                             'cannotApprove', s.cannot_approve, 'oldestDays', s.oldest_days) as summary,
           coalesce((
             select json_agg(json_build_object(
                      'id', k.id, 'employee_name', k.employee_name,
                      'leave_type_id', k.leave_type_id, 'leave_type_name', k.leave_type_name,
                      'tracks_balance', k.tracks_balance,
                      'start_date', k.start_date::text, 'end_date', k.end_date::text,
                      'reason', k.reason, 'status', k.status, 'created_at', k.created_at,
                      'balance', k.balance::text, 'working_days', k.working_days)
                    order by k.rn)
             from kept k
           ), '[]'::json) as rows
    from counts c, summary s`;

  if (!raw) throw new Error("The team queue read returned no row.");
  return {
    total: raw.total,
    page: shownPage(query.page, raw.total, per),
    pageSize: per,
    summary: raw.summary,
    rows: raw.rows.map((r) => {
      const balance = r.tracks_balance && r.balance !== null ? Number(r.balance) : null;
      return {
        ...r,
        created_at: new Date(r.created_at),
        balance,
        balanceCheck: checkOverBalance({
          tracksBalance: r.tracks_balance,
          balance,
          days: r.working_days,
        }),
      };
    }),
  };
}

export type TeamDecidedSummary = {
  total: number;
  /** Approved by the manager (an HR override is counted on its own). */
  approved: number;
  rejected: number;
  /** Approved by HR over the balance. */
  overridden: number;
};

type DecidedRaw = Omit<DecidedTeamRequestView, "decided_at"> & { decided_at: string };

/** One page of the team's decided requests, same scope, filters, order and paging. */
export async function getTeamDecidedPage(
  sql: Sql,
  { managerId, ...query }: TeamQueueQuery & { managerId: string },
): Promise<ListPage<DecidedTeamRequestView, TeamDecidedSummary>> {
  const pattern = query.q ? likePattern(query.q) : null;
  const asked = (query.page - 1) * query.per;
  const { per, sort, dir } = query;
  const type = query.type ?? null;
  const status = query.status ?? null;
  const from = query.from ?? null;
  const to = query.to ?? null;
  const [raw] = await sql<{ total: number; summary: TeamDecidedSummary; rows: DecidedRaw[] }[]>`
    with me as (
      select 1 as ok from public.users m where m.id = ${managerId}::uuid and m.role = 'manager'
    ),
    base as (
      select r.id, u.name as employee_name, r.leave_type_id, lt.name as leave_type_name,
             r.start_date, r.end_date, r.status, r.decision_note, r.decided_at,
             d.days as working_days,
             exists (
               select 1 from public.audit_log a
               where a.leave_request_id = r.id and a.action = 'override_approved'
             ) as overridden
      from public.leave_requests r
      join public.users u on u.id = r.user_id
      join public.leave_types lt on lt.id = r.leave_type_id
      cross join lateral (
        select count(*)::int as days
        from generate_series(r.start_date::timestamp, r.end_date::timestamp, interval '1 day') g
        where extract(isodow from g) < 6
      ) d
      where exists (select 1 from me)
        and u.manager_id = ${managerId}::uuid
        and r.status <> 'pending' and r.is_deleted = false
    ),
    f as (
      select b.* from base b
      where (${pattern}::text is null or b.employee_name ilike ${pattern}::text)
        and (${type}::uuid is null or b.leave_type_id = ${type}::uuid)
        and (${status}::text is null
             or (${status}::text = 'approved' and b.status = 'approved' and not b.overridden)
             or (${status}::text = 'rejected' and b.status = 'rejected')
             or (${status}::text = 'overridden' and b.overridden))
        and (${from}::date is null or b.end_date >= ${from}::date)
        and (${to}::date is null or b.start_date <= ${to}::date)
    ),
    counts as (select count(*)::int as total from f),
    summary as (
      select count(*)::int as total,
             count(*) filter (where status = 'approved' and not overridden)::int as approved,
             count(*) filter (where status = 'rejected')::int as rejected,
             count(*) filter (where overridden)::int as overridden
      from base
    ),
    ordered as (
      select f.*,
             row_number() over (
               order by
                 case when ${sort} = 'decided' and ${dir} = 'asc' then f.decided_at end asc,
                 case when ${sort} = 'decided' and ${dir} = 'desc' then f.decided_at end desc,
                 case when ${sort} = 'start' and ${dir} = 'asc' then f.start_date end asc,
                 case when ${sort} = 'start' and ${dir} = 'desc' then f.start_date end desc,
                 case when ${sort} = 'name' and ${dir} = 'asc' then f.employee_name end asc,
                 case when ${sort} = 'name' and ${dir} = 'desc' then f.employee_name end desc,
                 f.decided_at desc, f.id) as rn
      from f
    ),
    kept as (
      select o.* from ordered o
      order by o.rn
      offset (select least(${asked}::int,
                           greatest(0, (ceil(total / ${per}::numeric)::int - 1) * ${per}::int))
              from counts)
      limit ${per}::int
    )
    select c.total,
           json_build_object('total', s.total, 'approved', s.approved, 'rejected', s.rejected,
                             'overridden', s.overridden) as summary,
           coalesce((
             select json_agg(json_build_object(
                      'id', k.id, 'employee_name', k.employee_name,
                      'leave_type_name', k.leave_type_name,
                      'start_date', k.start_date::text, 'end_date', k.end_date::text,
                      'status', k.status, 'decision_note', k.decision_note,
                      'decided_at', k.decided_at, 'working_days', k.working_days,
                      'overridden', k.overridden)
                    order by k.rn)
             from kept k
           ), '[]'::json) as rows
    from counts c, summary s`;

  if (!raw) throw new Error("The team decided read returned no row.");
  return {
    total: raw.total,
    page: shownPage(query.page, raw.total, per),
    pageSize: per,
    summary: raw.summary,
    rows: raw.rows.map((r) => ({ ...r, decided_at: new Date(r.decided_at) })),
  };
}

export type TeamChoices = { leaveTypes: { id: string; name: string }[] };

/** What the leave type filter offers. ONE statement. Nothing unless `managerId` is a manager. */
export async function getTeamChoices(sql: Sql, managerId: string): Promise<TeamChoices> {
  const [row] = await sql<TeamChoices[]>`
    select coalesce((select json_agg(json_build_object('id', lt.id, 'name', lt.name) order by lt.name)
                     from public.leave_types lt
                     where exists (select 1 from public.users m
                                   where m.id = ${managerId}::uuid and m.role = 'manager')),
                    '[]'::json) as "leaveTypes"`;
  if (!row) throw new Error("The team choices read returned no row.");
  return row;
}
