import type { Sql } from "postgres";
import { AppError } from "@/lib/errors/app-error";
import { likePattern } from "@/lib/leave/audit-list";
import type { PolicyListQuery } from "@/lib/leave/policies-schema";

/**
 * EPIC-13 (TASK-071). HR Admin's Leave Policies: each employee's accrual rate (days a month) for each
 * balance-tracked leave type, and a change to one of them. HR's scope is the whole company, so there is
 * no per-person scope (a documented exception to AGENTS.md rule 3, like the override and org routes).
 * The scope is the role, and it is in the SQL: every read and the write take the signed-in user's id
 * (from the server session, never the client) and return or change nothing unless that user is an
 * `hr_admin`; the page's and route's role check is only the first gate.
 *
 * Only EMPLOYEES have a policy (EPIC-10): a manager or an HR Admin is never listed and never a target.
 * Only types that track a balance accrue (Unpaid has no policy). Rates are text ("1.25") so numeric
 * values never pass through a JavaScript float. No email and no leave data leave here.
 */

export type PolicyRate = {
  leaveTypeId: string;
  leaveTypeName: string;
  /** Days a month, or null when the employee has no policy for this type yet. */
  rate: string | null;
};

export type PolicyLastChange = { at: string; by: string };

export type PolicyPerson = {
  id: string;
  name: string;
  /** The employee's manager, for the team line under the name. Null when none. */
  managerName: string | null;
  /** The newest change to any of this employee's rates, or null when nothing was ever changed. */
  lastChange: PolicyLastChange | null;
  rates: PolicyRate[];
};

/** Company-wide numbers for the tiles: they ignore the search and the filters. */
export type PolicySummary = { employees: number; noPolicy: number; changedThisMonth: number };

export type PolicyPage = {
  total: number;
  page: number;
  pageSize: number;
  people: PolicyPerson[];
  summary: PolicySummary;
};

type PageRaw = {
  total: number;
  summary: PolicySummary;
  people: (Omit<PolicyPerson, "lastChange"> & {
    lastChange: { at: string; by: string } | null;
  })[];
};

/** Vacation first, then Sick, then any other tracked type by name, so the fields keep one order. */
const TYPE_ORDER = ["Vacation", "Sick"];
const rank = (name: string) => {
  const i = TYPE_ORDER.indexOf(name);
  return i === -1 ? TYPE_ORDER.length : i;
};
const byType = (a: PolicyRate, b: PolicyRate) =>
  rank(a.leaveTypeName) - rank(b.leaveTypeName) || a.leaveTypeName.localeCompare(b.leaveTypeName);

/**
 * One page of employees with a rate per balance-tracked leave type, and the company-wide summary. ONE
 * statement. Nothing unless `viewerId` is an hr_admin. The search is a literal part of the name (`%` and
 * `_` are not wildcards); the filters are bound values (team, leave type, status); the order is chosen by
 * `CASE` from the validated `sort` and `dir`, never built from text, with empty rates and "never changed"
 * last and name then id as the tie-break so paging is stable. The total is counted before the cut and the
 * page is clamped in SQL, so one past the end shows the last page. `timeZone` decides where "this month"
 * starts.
 */
export async function getPolicyPage(
  sql: Sql,
  { viewerId, timeZone, ...query }: PolicyListQuery & { viewerId: string; timeZone: string },
): Promise<PolicyPage> {
  const pattern = query.q ? likePattern(query.q) : null;
  const asked = (query.page - 1) * query.per;
  const { per, sort, dir } = query;
  const team = query.team ?? null;
  const type = query.type ?? null;
  const status = query.status ?? null;
  const [raw] = await sql<PageRaw[]>`
    with hr as (
      select 1 as ok from public.users h where h.id = ${viewerId}::uuid and h.role = 'hr_admin'
    ),
    month as (
      select (date_trunc('month', now() at time zone ${timeZone}::text) at time zone ${timeZone}::text) as starts
    ),
    base as (
      select u.id, u.name, u.manager_id,
             exists (select 1 from public.leave_types lt
                     where lt.tracks_balance and (${type}::uuid is null or lt.id = ${type}::uuid)
                       and not exists (select 1 from public.leave_policies lp
                                       where lp.user_id = u.id and lp.leave_type_id = lt.id)) as missing,
             exists (select 1 from public.leave_policy_changes c, month m
                     where c.user_id = u.id and c.changed_at >= m.starts
                       and (${type}::uuid is null or c.leave_type_id = ${type}::uuid)) as changed_now
      from public.users u
      where exists (select 1 from hr) and u.role = 'employee'
    ),
    f as (
      select b.id, b.name, b.manager_id,
             (select lp.accrual_per_month from public.leave_policies lp
              join public.leave_types lt on lt.id = lp.leave_type_id
              where lp.user_id = b.id and lt.name = 'Vacation') as vacation,
             (select lp.accrual_per_month from public.leave_policies lp
              join public.leave_types lt on lt.id = lp.leave_type_id
              where lp.user_id = b.id and lt.name = 'Sick') as sick,
             lc.changed_at as last_at, lc.by_name as last_by
      from base b
      left join lateral (
        select c.changed_at, a.name as by_name
        from public.leave_policy_changes c
        join public.users a on a.id = c.changed_by
        where c.user_id = b.id
        order by c.changed_at desc, c.id desc
        limit 1
      ) lc on true
      where (${pattern}::text is null or b.name ilike ${pattern}::text)
        and (${team}::uuid is null or b.manager_id = ${team}::uuid)
        and (${status}::text is null
             or (${status}::text = 'none' and b.missing)
             or (${status}::text = 'has' and not b.missing)
             or (${status}::text = 'changed' and b.changed_now))
    ),
    counts as (select count(*)::int as total from f),
    summary as (
      select count(*)::int as employees,
             count(*) filter (where exists (
               select 1 from public.leave_types lt
               where lt.tracks_balance and not exists (
                 select 1 from public.leave_policies lp
                 where lp.user_id = u.id and lp.leave_type_id = lt.id)))::int as no_policy,
             count(*) filter (where exists (
               select 1 from public.leave_policy_changes c, month m
               where c.user_id = u.id and c.changed_at >= m.starts))::int as changed_this_month
      from public.users u
      where exists (select 1 from hr) and u.role = 'employee'
    ),
    ordered as (
      select f.*,
             row_number() over (
      order by
        case when ${sort} = 'vacation' and ${dir} = 'asc' then f.vacation end asc nulls last,
        case when ${sort} = 'vacation' and ${dir} = 'desc' then f.vacation end desc nulls last,
        case when ${sort} = 'sick' and ${dir} = 'asc' then f.sick end asc nulls last,
        case when ${sort} = 'sick' and ${dir} = 'desc' then f.sick end desc nulls last,
        case when ${sort} = 'changed' and ${dir} = 'asc' then f.last_at end asc nulls last,
        case when ${sort} = 'changed' and ${dir} = 'desc' then f.last_at end desc nulls last,
        case when ${sort} = 'name' and ${dir} = 'desc' then f.name end desc,
        f.name, f.id) as rn
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
           json_build_object('employees', s.employees, 'noPolicy', s.no_policy,
                             'changedThisMonth', s.changed_this_month) as summary,
           coalesce((
             select json_agg(json_build_object(
                      'id', k.id, 'name', k.name,
                      'managerName', (select m.name from public.users m where m.id = k.manager_id),
                      'lastChange', case when k.last_at is null then null
                                         else json_build_object('at', k.last_at, 'by', k.last_by) end,
                      'rates', (
                        select json_agg(json_build_object(
                                 'leaveTypeId', lt.id, 'leaveTypeName', lt.name,
                                 'rate', lp.accrual_per_month::text))
                        from public.leave_types lt
                        left join public.leave_policies lp
                          on lp.leave_type_id = lt.id and lp.user_id = k.id
                        where lt.tracks_balance and (${type}::uuid is null or lt.id = ${type}::uuid)))
                    order by k.rn)
             from kept k
           ), '[]'::json) as people
    from counts c, summary s`;

  if (!raw) throw new Error("The leave policies read returned no row.");
  const pages = Math.max(1, Math.ceil(raw.total / per));
  return {
    total: raw.total,
    page: Math.min(query.page, pages),
    pageSize: per,
    summary: raw.summary,
    people: raw.people.map((p) => ({
      ...p,
      lastChange: p.lastChange
        ? { at: new Date(p.lastChange.at).toISOString(), by: p.lastChange.by }
        : null,
      rates: [...p.rates].sort(byType),
    })),
  };
}

export type PolicyChoices = {
  /** Managers with at least one employee, for the Team filter. */
  managers: { id: string; name: string }[];
  /** The leave types that accrue, for the Leave type filter. */
  leaveTypes: { id: string; name: string }[];
};

/** What the filters offer. ONE statement. Nothing unless `viewerId` is an hr_admin. */
export async function getPolicyChoices(sql: Sql, viewerId: string): Promise<PolicyChoices> {
  const [row] = await sql<PolicyChoices[]>`
    select
      coalesce((select json_agg(json_build_object('id', m.id, 'name', m.name) order by m.name, m.id)
                from public.users m
                where m.role = 'manager'
                  and exists (select 1 from public.users e where e.manager_id = m.id and e.role = 'employee')
                  and exists (select 1 from public.users h where h.id = ${viewerId}::uuid and h.role = 'hr_admin')),
               '[]'::json) as managers,
      coalesce((select json_agg(json_build_object('id', lt.id, 'name', lt.name) order by lt.name)
                from public.leave_types lt
                where lt.tracks_balance
                  and exists (select 1 from public.users h where h.id = ${viewerId}::uuid and h.role = 'hr_admin')),
               '[]'::json) as "leaveTypes"`;
  if (!row) throw new Error("The leave policy choices read returned no row.");
  return row;
}

export type PolicyChangeView = {
  id: string;
  employeeName: string;
  leaveTypeName: string;
  changedByName: string;
  /** Null when the employee had no policy for this type before. */
  oldRate: string | null;
  newRate: string;
  changedAt: string;
};

type ChangeRow = {
  id: string;
  employee_name: string;
  leave_type_name: string;
  changed_by_name: string;
  old_rate: string | null;
  new_rate: string;
  changed_at: Date;
};

export const RECENT_CHANGES = 5;

/** The latest changes, company-wide (at most 5). ONE statement. Nothing unless `viewerId` is an hr_admin. */
export async function getRecentPolicyChanges(
  sql: Sql,
  viewerId: string,
): Promise<PolicyChangeView[]> {
  // The newest ten are picked from the change table alone (its index on changed_at), then named: the
  // history only grows, so joining every change before cutting it to ten would get slower for ever.
  const rows = await sql<ChangeRow[]>`
    with latest as (
      select c.id, c.user_id, c.leave_type_id, c.changed_by, c.old_rate, c.new_rate, c.changed_at
      from public.leave_policy_changes c
      where exists (select 1 from public.users h where h.id = ${viewerId}::uuid and h.role = 'hr_admin')
      order by c.changed_at desc, c.id
      limit ${RECENT_CHANGES}::int
    )
    select c.id, e.name as employee_name, lt.name as leave_type_name, a.name as changed_by_name,
           c.old_rate::text as old_rate, c.new_rate::text as new_rate, c.changed_at
    from latest c
    join public.users e on e.id = c.user_id
    join public.leave_types lt on lt.id = c.leave_type_id
    join public.users a on a.id = c.changed_by
    order by c.changed_at desc, c.id`;
  return rows.map((r) => ({
    id: r.id,
    employeeName: r.employee_name,
    leaveTypeName: r.leave_type_name,
    changedByName: r.changed_by_name,
    oldRate: r.old_rate,
    newRate: r.new_rate,
    changedAt: r.changed_at.toISOString(),
  }));
}

/** The advisory-lock key for one employee's policy of one leave type (a test holds it to prove writes wait). */
export function policyLockKey(userId: string, leaveTypeId: string): string {
  return `leave_policy:${userId}:${leaveTypeId}`;
}

export type SetPolicyRateResult = {
  /** `unchanged` when the rate was already that value: nothing is written. */
  status: "changed" | "unchanged";
  oldRate: string | null;
  newRate: string;
  /** When the change was recorded and by whom (the session user's name); null when nothing changed. */
  changedAt: string | null;
  changedByName: string | null;
};

type Checks = {
  actor_ok: boolean;
  actor_name: string | null;
  employee_ok: boolean;
  type_ok: boolean;
  old_rate: string | null;
};

/**
 * Sets one employee's accrual rate for one leave type and records the change, in ONE transaction:
 * (1) a lock on this employee and type, so two HR Admins cannot record a stale "old rate"; (2) the
 * checks, decided in SQL: the actor is an hr_admin, the target is an employee, the type tracks a
 * balance, plus the current rate; (3) the rate and its change row together. An unchanged rate writes
 * nothing. A target that is not an employee, an unknown id and a type without a balance all give the
 * same not-found. The change applies from the next accrual run: a month already accrued is never
 * rewritten (`accrual_ledger`), and nothing is paid back for earlier months.
 */
export async function setPolicyRate(
  sql: Sql,
  input: { actorId: string; userId: string; leaveTypeId: string; rate: string },
): Promise<SetPolicyRateResult> {
  const { actorId, userId, leaveTypeId, rate } = input;
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${policyLockKey(userId, leaveTypeId)}))`;

    const [checks] = await tx<Checks[]>`
      select
        exists (select 1 from public.users a where a.id = ${actorId}::uuid and a.role = 'hr_admin') as actor_ok,
        (select a.name from public.users a where a.id = ${actorId}::uuid and a.role = 'hr_admin') as actor_name,
        exists (select 1 from public.users u where u.id = ${userId}::uuid and u.role = 'employee') as employee_ok,
        exists (select 1 from public.leave_types lt
                where lt.id = ${leaveTypeId}::uuid and lt.tracks_balance) as type_ok,
        (select lp.accrual_per_month::text from public.leave_policies lp
         where lp.user_id = ${userId}::uuid and lp.leave_type_id = ${leaveTypeId}::uuid) as old_rate`;

    if (!checks?.actor_ok) {
      throw new AppError("FORBIDDEN", "You do not have access to this resource.");
    }
    if (!checks.employee_ok || !checks.type_ok) {
      throw new AppError("NOT_FOUND", "That employee or leave type was not found.");
    }

    const oldRate = checks.old_rate;
    if (oldRate !== null && Number(oldRate) === Number(rate)) {
      return {
        status: "unchanged",
        oldRate,
        newRate: oldRate,
        changedAt: null,
        changedByName: null,
      };
    }

    const [written] = await tx<{ changed_at: Date }[]>`
      with up as (
        insert into public.leave_policies (user_id, leave_type_id, accrual_per_month)
        values (${userId}::uuid, ${leaveTypeId}::uuid, ${rate}::numeric)
        on conflict (user_id, leave_type_id)
        do update set accrual_per_month = excluded.accrual_per_month
        returning user_id, leave_type_id
      )
      insert into public.leave_policy_changes (user_id, leave_type_id, changed_by, old_rate, new_rate)
      select up.user_id, up.leave_type_id, ${actorId}::uuid, ${oldRate}::numeric, ${rate}::numeric
      from up
      returning changed_at`;

    return {
      status: "changed",
      oldRate,
      newRate: rate,
      changedAt: written ? written.changed_at.toISOString() : null,
      changedByName: checks.actor_name,
    };
  });
}
