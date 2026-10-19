import type { Sql } from "postgres";
import type { IsoDate } from "@/lib/leave/calendar-layout";
import { likePattern } from "@/lib/leave/audit-list";

/**
 * EPIC-7 (TASK-042). HR's company calendar reads: how many people are out each weekday, and who is
 * out on one day. HR's scope is everyone, so there is no per-person scope (a documented exception to
 * AGENTS.md rule 3, like the override route). The scope is the role, and it is in the SQL: every read
 * takes the signed-in user's id (from the server session, never the client) and returns nothing unless
 * that user is an `hr_admin`; the page's `requireRole` is only the first gate. The optional team and
 * leave type are filters, never an identity. Read-only: nothing here
 * inserts, updates or deletes, and the employee's free-text `reason` is never selected.
 *
 * Rules shared by both reads: only pending and approved requests count, a soft-deleted or rejected
 * request never does, weekends never count, and a request counts on every weekday it covers (so one
 * that spans two months is counted in both). Dates come back as text so postgres.js never turns them
 * into timezone-shifting Date objects.
 */

export const HR_DAY_PAGE_SIZE = 25;

/** The signed-in user. Every read returns nothing unless this user is an hr_admin. */
export type HrViewer = { viewerId: string };

export type HrCalendarFilters = {
  /** Only people whose manager is this person (the "team" filter). */
  managerId?: string | undefined;
  leaveTypeId?: string | undefined;
};

/** People out on one weekday. `byType` is empty for a day nobody is out. */
export type HrDayCount = {
  day: IsoDate;
  /** Distinct people with a pending or approved request that day. */
  total: number;
  approved: number;
  pending: number;
  byType: { leaveTypeName: string; approved: number; pending: number }[];
};

type MonthRow = {
  day: string;
  leave_type: string | null;
  total: number;
  approved: number;
  pending: number;
};

/**
 * One statement. `from` and `to` are the first and last day of the month shown (inclusive); the
 * series never runs past them. Grouping sets give one row per (day, leave type) and one per day, so a
 * person with two overlapping requests of different types is still counted once in the day's total.
 * Days nobody is out have no row; the caller fills them with zero.
 */
export async function getMonthCounts(
  sql: Sql,
  {
    viewerId,
    from,
    to,
    managerId,
    leaveTypeId,
  }: HrViewer & { from: IsoDate; to: IsoDate } & HrCalendarFilters,
): Promise<HrDayCount[]> {
  const manager = managerId ?? null;
  const type = leaveTypeId ?? null;
  const rows = await sql<MonthRow[]>`
    with days as (
      select g::date as day
      from generate_series(${from}::date, ${to}::date, interval '1 day') g
      where extract(isodow from g) < 6
    )
    select d.day::text as day, lt.name as leave_type,
           (count(distinct r.user_id))::int as total,
           (count(distinct r.user_id) filter (where r.status = 'approved'))::int as approved,
           (count(distinct r.user_id) filter (where r.status = 'pending'))::int as pending
    from days d
    join public.leave_requests r
      on r.start_date <= d.day and r.end_date >= d.day
     and r.is_deleted = false
     and r.status in ('pending', 'approved')
     and r.start_date <= ${to}::date and r.end_date >= ${from}::date
    join public.users u on u.id = r.user_id
    join public.leave_types lt on lt.id = r.leave_type_id
    where exists (select 1 from public.users h where h.id = ${viewerId}::uuid and h.role = 'hr_admin')
      and (${manager}::uuid is null or u.manager_id = ${manager}::uuid)
      and (${type}::uuid is null or r.leave_type_id = ${type}::uuid)
    group by grouping sets ((d.day, lt.name), (d.day))
    order by d.day, lt.name nulls first`;

  const byDay = new Map<string, HrDayCount>();
  for (const row of rows) {
    let entry = byDay.get(row.day);
    if (!entry) {
      entry = { day: row.day, total: 0, approved: 0, pending: 0, byType: [] };
      byDay.set(row.day, entry);
    }
    if (row.leave_type === null) {
      entry.total = row.total;
      entry.approved = row.approved;
      entry.pending = row.pending;
    } else {
      entry.byType.push({
        leaveTypeName: row.leave_type,
        approved: row.approved,
        pending: row.pending,
      });
    }
  }
  return [...byDay.values()];
}

export type HrDayPerson = {
  requestId: string;
  userId: string;
  name: string;
  /** The person's manager (their team); null when they have none. */
  managerName: string | null;
  leaveTypeName: string;
  startDate: IsoDate;
  endDate: IsoDate;
  status: "pending" | "approved";
};

export type HrDayPage = {
  total: number;
  /** The page shown: the one asked for, or the last one when it is past the end. */
  page: number;
  people: HrDayPerson[];
};

type DayRaw = { total: number; people: HrDayPerson[] };

/**
 * One statement: the people out on `day` (a weekday; a weekend returns nobody), 25 per page, in name
 * order, optionally narrowed by a part of the name. The offset is clamped in SQL so a page past the
 * end shows the last page.
 */
export async function getDayPeople(
  sql: Sql,
  {
    viewerId,
    day,
    q,
    page,
    managerId,
    leaveTypeId,
  }: HrViewer & { day: IsoDate; q?: string | undefined; page: number } & HrCalendarFilters,
): Promise<HrDayPage> {
  const manager = managerId ?? null;
  const type = leaveTypeId ?? null;
  const pattern = q ? likePattern(q) : null;
  const asked = (page - 1) * HR_DAY_PAGE_SIZE;

  const [raw] = await sql<DayRaw[]>`
    with f as (
      select r.id, r.user_id, r.leave_type_id, r.start_date, r.end_date, r.status,
             u.name as person_name, u.manager_id
      from public.leave_requests r
      join public.users u on u.id = r.user_id
      where exists (select 1 from public.users h where h.id = ${viewerId}::uuid and h.role = 'hr_admin')
        and extract(isodow from ${day}::date) < 6
        and r.is_deleted = false
        and r.status in ('pending', 'approved')
        and r.start_date <= ${day}::date and r.end_date >= ${day}::date
        and (${manager}::uuid is null or u.manager_id = ${manager}::uuid)
        and (${type}::uuid is null or r.leave_type_id = ${type}::uuid)
        and (${pattern}::text is null or u.name ilike ${pattern})
    ),
    counts as (select count(*)::int as total from f),
    page as (
      select f.*, lt.name as leave_type_name, m.name as manager_name
      from f
      join public.leave_types lt on lt.id = f.leave_type_id
      left join public.users m on m.id = f.manager_id
      order by f.person_name, lt.name, f.id
      offset (select least(${asked}::int,
                           greatest(0, (ceil(total / ${HR_DAY_PAGE_SIZE}::numeric)::int - 1)
                                       * ${HR_DAY_PAGE_SIZE}::int))
              from counts)
      limit ${HR_DAY_PAGE_SIZE}
    )
    select c.total,
           coalesce((
             select json_agg(json_build_object(
                      'requestId', p.id, 'userId', p.user_id, 'name', p.person_name,
                      'managerName', p.manager_name, 'leaveTypeName', p.leave_type_name,
                      'startDate', p.start_date::text, 'endDate', p.end_date::text,
                      'status', p.status)
                    order by p.person_name, p.leave_type_name, p.id)
             from page p
           ), '[]'::json) as people
    from counts c`;

  if (!raw) throw new Error("The HR day read returned no row.");
  const pages = Math.max(1, Math.ceil(raw.total / HR_DAY_PAGE_SIZE));
  return { total: raw.total, page: Math.min(page, pages), people: raw.people };
}

export type HrCalendarChoices = {
  leaveTypes: { id: string; name: string }[];
  /** People who have at least one direct report: the "team" options. */
  managers: { id: string; name: string }[];
};

/** The options of the team and leave type selects, in one statement. */
export async function getHrCalendarChoices(
  sql: Sql,
  { viewerId }: HrViewer,
): Promise<HrCalendarChoices> {
  const [row] = await sql<HrCalendarChoices[]>`
    select
      coalesce((select json_agg(json_build_object('id', lt.id, 'name', lt.name) order by lt.name)
                from public.leave_types lt
                where exists (select 1 from public.users h
                              where h.id = ${viewerId}::uuid and h.role = 'hr_admin')),
               '[]'::json) as "leaveTypes",
      coalesce((select json_agg(json_build_object('id', m.id, 'name', m.name) order by m.name, m.id)
                from public.users m
                where exists (select 1 from public.users e where e.manager_id = m.id)
                  and exists (select 1 from public.users h
                              where h.id = ${viewerId}::uuid and h.role = 'hr_admin')),
               '[]'::json) as managers`;
  if (!row) throw new Error("The HR calendar choices read returned no row.");
  return row;
}
