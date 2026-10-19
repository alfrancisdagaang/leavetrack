import type { Sql } from "postgres";

/**
 * TASK-039. What the HR override page reads. Two statements, one per section.
 *
 * DELIBERATE EXCEPTION to AGENTS.md rule 3 (manager scoping), the same one as `override.ts`: the
 * queue is not scoped to a team. Its scope is the role (the page's `requireRole("hr_admin")`),
 * "not the caller's own request" and the over-balance condition, all in the SQL below, so nothing
 * is fetched broadly and filtered in TypeScript. The caller id is the session user.
 *
 * The queue lists exactly the requests `overrideLeaveRequest` will accept: pending, not deleted,
 * a balance-tracked type, a balance row, and `0 <= balance < working days`. Working days are
 * counted in SQL (Mon-Fri, inclusive) and must agree with `countWorkingDays`; the gated test
 * compares the two.
 */
export const OVERRIDE_QUEUE_LIMIT = 50;
export const RECENT_OVERRIDES_LIMIT = 10;

export type OverrideQueueRow = {
  id: string;
  employee_name: string;
  /** The employee's manager; null when they have none. */
  manager_name: string | null;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  /** The employee's reason: selected here only because every row is a pending request. */
  reason: string;
  created_at: Date;
  working_days: number;
  /** numeric as text, so no floating point: the balance and `working_days - balance`. */
  balance: string;
  shortfall: string;
};

export type OverrideQueue = {
  /** The oldest requests first, at most OVERRIDE_QUEUE_LIMIT. */
  rows: OverrideQueueRow[];
  /** Every request waiting for an override, which may be more than `rows`. */
  total: number;
};

export async function getOverrideQueue(sql: Sql, hrId: string): Promise<OverrideQueue> {
  const rows = await sql<(OverrideQueueRow & { total: number })[]>`
    select r.id, u.name as employee_name, m.name as manager_name, lt.name as leave_type_name,
           r.start_date::text as start_date, r.end_date::text as end_date, r.reason, r.created_at,
           d.days as working_days, lb.balance::text as balance,
           (d.days - lb.balance)::text as shortfall,
           (count(*) over ())::int as total
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
    where r.status = 'pending' and r.is_deleted = false and r.user_id <> ${hrId}
      and lb.balance >= 0 and lb.balance < d.days
    order by r.created_at, r.id
    limit ${OVERRIDE_QUEUE_LIMIT}`;

  return {
    rows: rows.map(({ total: _total, ...row }) => row),
    total: rows[0]?.total ?? 0,
  };
}

/**
 * How many requests wait for an override (the HR dashboard card): ONE statement, the same
 * conditions as `getOverrideQueue` and so as `overrideLeaveRequest`. The gated test compares the
 * count with the queue's `total`, so the three cannot drift apart unnoticed.
 */
export async function getOverrideCount(sql: Sql, hrId: string): Promise<number> {
  const [row] = await sql<{ total: number }[]>`
    select count(*)::int as total
    from public.leave_requests r
    join public.leave_types lt on lt.id = r.leave_type_id and lt.tracks_balance
    join public.leave_balances lb
      on lb.user_id = r.user_id and lb.leave_type_id = r.leave_type_id
    cross join lateral (
      select count(*)::int as days
      from generate_series(r.start_date::timestamp, r.end_date::timestamp, interval '1 day') g
      where extract(isodow from g) < 6
    ) d
    where r.status = 'pending' and r.is_deleted = false and r.user_id <> ${hrId}
      and lb.balance >= 0 and lb.balance < d.days`;
  return row?.total ?? 0;
}

export type RecentOverrideView = {
  id: string;
  employee_name: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  approved_by_name: string;
  occurred_at: Date;
  /** numeric as text. */
  days_requested: string;
  shortfall: string;
};

/**
 * The latest override approvals, newest first. Read from the append-only audit log, so a request
 * that was cancelled later still shows. No reason or note is selected. HR rejections are not
 * listed: the audit log has no marker that tells one from an ordinary rejection (Audit History
 * shows them).
 */
export async function getRecentOverrides(sql: Sql): Promise<RecentOverrideView[]> {
  return sql<RecentOverrideView[]>`
    select a.id, u.name as employee_name, lt.name as leave_type_name,
           r.start_date::text as start_date, r.end_date::text as end_date,
           actor.name as approved_by_name, a.occurred_at,
           a.days_requested::text as days_requested, a.shortfall::text as shortfall
    from public.audit_log a
    join public.leave_requests r on r.id = a.leave_request_id
    join public.users u on u.id = r.user_id
    join public.leave_types lt on lt.id = r.leave_type_id
    join public.users actor on actor.id = a.actor_id
    where a.action = 'override_approved'
    order by a.occurred_at desc, a.id desc
    limit ${RECENT_OVERRIDES_LIMIT}`;
}
