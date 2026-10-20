import type { Sql } from "postgres";
import { likePattern } from "@/lib/leave/audit-list";
import { shownPage, type ListPage } from "@/lib/leave/list-query";
import type { OverrideListQuery } from "@/lib/leave/override-list-schema";
import type { OverrideQueueRow, RecentOverrideView } from "@/lib/leave/override-queue";

/**
 * Balance Overrides at scale (EPIC-14): one page of what waits for HR, and of what HR already overrode,
 * filtered, sorted and paged in SQL. The same DELIBERATE EXCEPTION to AGENTS.md rule 3 as `override-queue.ts`
 * and `override.ts`: not scoped to a team; the scope is the role (the viewer must be an `hr_admin`, checked in
 * the SQL, never only by the page), "not the caller's own request" and the over-balance condition. The waiting
 * list keeps EXACTLY the conditions of `getOverrideQueue`, `getOverrideCount` and `overrideLeaveRequest`; the
 * filters only narrow it, so unfiltered its total equals the dashboard's count (a gated test compares them).
 * The old cap of 50 is gone: HR can page to every waiting request.
 *
 * Filters and page size are bound values; the order is a `CASE` over the validated `sort` and `dir` (never
 * text), with date then id as the tie-break so paging is stable; the total is counted before the cut and the
 * page is clamped in SQL.
 */

export type OverrideWaitingSummary = {
  waiting: number;
  /** The largest days-over-balance among everything waiting, as text ("3.00"); null when nothing waits. */
  biggestShortfall: string | null;
  /** Whole days since the oldest waiting request was submitted; null when nothing waits. */
  oldestDays: number | null;
};

type WaitingRaw = Omit<OverrideQueueRow, "created_at"> & { created_at: string };

export async function getOverrideQueuePage(
  sql: Sql,
  { hrId, ...query }: OverrideListQuery & { hrId: string },
): Promise<ListPage<OverrideQueueRow, OverrideWaitingSummary>> {
  const pattern = query.q ? likePattern(query.q) : null;
  const asked = (query.page - 1) * query.per;
  const { per, sort, dir } = query;
  const type = query.type ?? null;
  const team = query.team ?? null;
  const from = query.from ?? null;
  const to = query.to ?? null;
  const [raw] = await sql<{ total: number; summary: OverrideWaitingSummary; rows: WaitingRaw[] }[]>`
    with hr as (
      select 1 as ok from public.users h where h.id = ${hrId}::uuid and h.role = 'hr_admin'
    ),
    base as (
      select r.id, u.name as employee_name, u.manager_id, m.name as manager_name,
             r.leave_type_id, lt.name as leave_type_name, r.start_date, r.end_date, r.reason,
             r.created_at, d.days as working_days, lb.balance,
             (d.days - lb.balance) as shortfall
      from public.leave_requests r
      join public.users u on u.id = r.user_id
      left join public.users m on m.id = u.manager_id
      join public.leave_types lt on lt.id = r.leave_type_id and lt.tracks_balance
      join public.leave_balances lb
        on lb.user_id = r.user_id and lb.leave_type_id = r.leave_type_id
      cross join lateral (
        select count(*)::int as days
        from generate_series(r.start_date::timestamp, r.end_date::timestamp, interval '1 day') g
        where extract(isodow from g) < 6
      ) d
      where exists (select 1 from hr)
        and r.status = 'pending' and r.is_deleted = false and r.user_id <> ${hrId}::uuid
        and lb.balance >= 0 and lb.balance < d.days
    ),
    f as (
      select b.* from base b
      where (${pattern}::text is null or b.employee_name ilike ${pattern}::text)
        and (${type}::uuid is null or b.leave_type_id = ${type}::uuid)
        and (${team}::uuid is null or b.manager_id = ${team}::uuid)
        and (${from}::date is null or b.end_date >= ${from}::date)
        and (${to}::date is null or b.start_date <= ${to}::date)
    ),
    counts as (select count(*)::int as total from f),
    summary as (
      select count(*)::int as waiting,
             max(shortfall)::text as biggest_shortfall,
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
                 case when ${sort} = 'shortfall' and ${dir} = 'asc' then f.shortfall end asc,
                 case when ${sort} = 'shortfall' and ${dir} = 'desc' then f.shortfall end desc,
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
           json_build_object('waiting', s.waiting, 'biggestShortfall', s.biggest_shortfall,
                             'oldestDays', s.oldest_days) as summary,
           coalesce((
             select json_agg(json_build_object(
                      'id', k.id, 'employee_name', k.employee_name, 'manager_name', k.manager_name,
                      'leave_type_name', k.leave_type_name,
                      'start_date', k.start_date::text, 'end_date', k.end_date::text,
                      'reason', k.reason, 'created_at', k.created_at,
                      'working_days', k.working_days, 'balance', k.balance::text,
                      'shortfall', k.shortfall::text)
                    order by k.rn)
             from kept k
           ), '[]'::json) as rows
    from counts c, summary s`;

  if (!raw) throw new Error("The override queue read returned no row.");
  return {
    total: raw.total,
    page: shownPage(query.page, raw.total, per),
    pageSize: per,
    summary: raw.summary,
    rows: raw.rows.map((r) => ({ ...r, created_at: new Date(r.created_at) })),
  };
}

export type OverriddenSummary = {
  total: number;
  /** All the days HR let through over a balance, as text ("12.50"). */
  totalShortfall: string;
  thisMonth: number;
};

type OverriddenRaw = Omit<RecentOverrideView, "occurred_at"> & { occurred_at: string };

/**
 * One page of the override approvals, from the append-only audit log (so a request that was cancelled later
 * still shows). No reason or note is selected. HR rejections are not listed: the audit log has no marker that
 * tells one from an ordinary rejection (Audit History shows them). `timeZone` decides where "this month" starts.
 */
export async function getOverriddenPage(
  sql: Sql,
  { hrId, timeZone, ...query }: OverrideListQuery & { hrId: string; timeZone: string },
): Promise<ListPage<RecentOverrideView, OverriddenSummary>> {
  const pattern = query.q ? likePattern(query.q) : null;
  const asked = (query.page - 1) * query.per;
  const { per, sort, dir } = query;
  const type = query.type ?? null;
  const team = query.team ?? null;
  const from = query.from ?? null;
  const to = query.to ?? null;
  const [raw] = await sql<{ total: number; summary: OverriddenSummary; rows: OverriddenRaw[] }[]>`
    with hr as (
      select 1 as ok from public.users h where h.id = ${hrId}::uuid and h.role = 'hr_admin'
    ),
    month as (
      select (date_trunc('month', now() at time zone ${timeZone}::text) at time zone ${timeZone}::text) as starts
    ),
    base as (
      select a.id, u.name as employee_name, u.manager_id, r.leave_type_id,
             lt.name as leave_type_name, r.start_date, r.end_date,
             actor.name as approved_by_name, a.occurred_at,
             a.days_requested, a.shortfall
      from public.audit_log a
      join public.leave_requests r on r.id = a.leave_request_id
      join public.users u on u.id = r.user_id
      join public.leave_types lt on lt.id = r.leave_type_id
      join public.users actor on actor.id = a.actor_id
      where exists (select 1 from hr) and a.action = 'override_approved'
    ),
    f as (
      select b.* from base b
      where (${pattern}::text is null or b.employee_name ilike ${pattern}::text)
        and (${type}::uuid is null or b.leave_type_id = ${type}::uuid)
        and (${team}::uuid is null or b.manager_id = ${team}::uuid)
        and (${from}::date is null or b.end_date >= ${from}::date)
        and (${to}::date is null or b.start_date <= ${to}::date)
    ),
    counts as (select count(*)::int as total from f),
    summary as (
      select count(*)::int as total,
             coalesce(sum(b.shortfall), 0)::text as total_shortfall,
             count(*) filter (where b.occurred_at >= m.starts)::int as this_month
      from base b, month m
    ),
    ordered as (
      select f.*,
             row_number() over (
               order by
                 case when ${sort} = 'approved' and ${dir} = 'asc' then f.occurred_at end asc,
                 case when ${sort} = 'approved' and ${dir} = 'desc' then f.occurred_at end desc,
                 case when ${sort} = 'shortfall' and ${dir} = 'asc' then f.shortfall end asc,
                 case when ${sort} = 'shortfall' and ${dir} = 'desc' then f.shortfall end desc,
                 case when ${sort} = 'name' and ${dir} = 'asc' then f.employee_name end asc,
                 case when ${sort} = 'name' and ${dir} = 'desc' then f.employee_name end desc,
                 case when ${sort} = 'start' and ${dir} = 'asc' then f.start_date end asc,
                 case when ${sort} = 'start' and ${dir} = 'desc' then f.start_date end desc,
                 f.occurred_at desc, f.id) as rn
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
           json_build_object('total', s.total, 'totalShortfall', s.total_shortfall,
                             'thisMonth', s.this_month) as summary,
           coalesce((
             select json_agg(json_build_object(
                      'id', k.id, 'employee_name', k.employee_name,
                      'leave_type_name', k.leave_type_name,
                      'start_date', k.start_date::text, 'end_date', k.end_date::text,
                      'approved_by_name', k.approved_by_name, 'occurred_at', k.occurred_at,
                      'days_requested', k.days_requested::text, 'shortfall', k.shortfall::text)
                    order by k.rn)
             from kept k
           ), '[]'::json) as rows
    from counts c, summary s`;

  if (!raw) throw new Error("The overridden read returned no row.");
  return {
    total: raw.total,
    page: shownPage(query.page, raw.total, per),
    pageSize: per,
    summary: raw.summary,
    rows: raw.rows.map((r) => ({ ...r, occurred_at: new Date(r.occurred_at) })),
  };
}

export type OverrideChoices = {
  /** The leave types that track a balance (only those can be over it). */
  leaveTypes: { id: string; name: string }[];
  /** Managers with at least one employee, for the Team filter. */
  managers: { id: string; name: string }[];
};

/** What the filters offer. ONE statement. Nothing unless `hrId` is an hr_admin. */
export async function getOverrideChoices(sql: Sql, hrId: string): Promise<OverrideChoices> {
  const [row] = await sql<OverrideChoices[]>`
    select
      coalesce((select json_agg(json_build_object('id', lt.id, 'name', lt.name) order by lt.name)
                from public.leave_types lt
                where lt.tracks_balance
                  and exists (select 1 from public.users h where h.id = ${hrId}::uuid and h.role = 'hr_admin')),
               '[]'::json) as "leaveTypes",
      coalesce((select json_agg(json_build_object('id', m.id, 'name', m.name) order by m.name, m.id)
                from public.users m
                where m.role = 'manager'
                  and exists (select 1 from public.users e where e.manager_id = m.id and e.role = 'employee')
                  and exists (select 1 from public.users h where h.id = ${hrId}::uuid and h.role = 'hr_admin')),
               '[]'::json) as managers`;
  if (!row) throw new Error("The override choices read returned no row.");
  return row;
}
