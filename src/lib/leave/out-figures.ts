import type { Sql } from "postgres";
import type { IsoDate } from "@/lib/leave/calendar-layout";

/**
 * The dashboard's "who is out" figures for HR admins (the whole company) and managers (their direct
 * reports): how many people are out on each weekday from today through today + 6, how many different
 * people that is over the week, and how many requests are still pending. ONE statement.
 *
 * The scope is chosen in the SQL from the signed-in user's own role (AGENTS.md rule 3): `company`
 * answers only for an `hr_admin`, `team` only for a `manager` and only for people whose `manager_id`
 * is that manager. Any other user, or an unknown id, gets nothing. The rules are the Company
 * Calendar's: only pending and approved requests, never soft-deleted ones, weekdays only, and a
 * person counts once however many requests cover the day. Dates come back as text.
 */
export type OutScope = "company" | "team";

export type OutDay = { day: IsoDate; total: number; pending: number };

export type OutFigures = {
  /** The weekdays from today through today + 6, in order (a weekend day is not in the list). */
  days: OutDay[];
  /** Different people out on at least one of those days. */
  weekPeople: number;
  /** Company: every pending request. Team: pending requests from the manager's direct reports. */
  pendingTotal: number;
};

type Row = { days: OutDay[]; week_people: number; pending_total: number };

export async function getOutFigures(
  sql: Sql,
  { viewerId, scope, today }: { viewerId: string; scope: OutScope; today: IsoDate },
): Promise<OutFigures> {
  const company = scope === "company";
  const role = company ? "hr_admin" : "manager";
  const [row] = await sql<Row[]>`
    with viewer as (
      select u.id from public.users u
      where u.id = ${viewerId}::uuid and u.role = ${role}::public.user_role
    ),
    days as (
      select g::date as day
      from generate_series(${today}::date, ${today}::date + 6, interval '1 day') g
      where extract(isodow from g) < 6
    ),
    people as (
      select r.user_id, r.start_date, r.end_date, r.status
      from public.leave_requests r
      join public.users u on u.id = r.user_id
      cross join viewer v
      where r.is_deleted = false
        and r.status in ('pending', 'approved')
        and r.start_date <= ${today}::date + 6 and r.end_date >= ${today}::date
        and (${company}::boolean or u.manager_id = v.id)
    ),
    per_day as (
      select d.day,
             (count(distinct p.user_id))::int as total,
             (count(distinct p.user_id) filter (where p.status = 'pending'))::int as pending
      from days d
      left join people p on p.start_date <= d.day and p.end_date >= d.day
      group by d.day
    )
    select
      coalesce((
        select json_agg(json_build_object('day', pd.day::text, 'total', pd.total, 'pending', pd.pending)
                        order by pd.day)
        from per_day pd
        where exists (select 1 from viewer)
      ), '[]'::json) as days,
      (select count(distinct p.user_id)::int from people p
        where exists (select 1 from days d where p.start_date <= d.day and p.end_date >= d.day)
      ) as week_people,
      (select count(*)::int
         from public.leave_requests q
         join public.users qu on qu.id = q.user_id
         cross join viewer v
        where q.status = 'pending' and q.is_deleted = false
          and (${company}::boolean or qu.manager_id = v.id)
      ) as pending_total`;
  if (!row) throw new Error("The out figures read returned no row.");
  return { days: row.days, weekPeople: row.week_people, pendingTotal: row.pending_total };
}

const isWeekday = (iso: IsoDate) => {
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return weekday >= 1 && weekday <= 5;
};

/** Today's figures, or `weekend` when today is a Saturday or Sunday (nobody is counted then). */
export function outToday(
  figures: OutFigures,
  today: IsoDate,
): { weekend: true } | { weekend: false; total: number; pending: number } {
  if (!isWeekday(today)) return { weekend: true };
  const found = figures.days.find((d) => d.day === today);
  return { weekend: false, total: found?.total ?? 0, pending: found?.pending ?? 0 };
}

/** The last day of the window, today + 6. */
export function windowEnd(today: IsoDate): IsoDate {
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return end.toISOString().slice(0, 10);
}
