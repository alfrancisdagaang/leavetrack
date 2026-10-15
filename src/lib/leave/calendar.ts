import type { Sql } from "postgres";
import type { UserRole } from "@/lib/db/types";
import type { CalendarRequest, CalendarStatus, IsoDate } from "@/lib/leave/calendar-layout";

/**
 * US-10. The requests shown on the dashboard calendar between `from` and `to` (inclusive).
 * Scope is in the SQL (AGENTS.md rule 3), chosen from the SERVER session, never from the client:
 *   - employee: only their own requests
 *   - manager:  their own and their direct reports' (`u.manager_id`)
 *   - hr_admin: everyone
 * A request that starts before `from` or ends after `to` is included, so a span that crosses a
 * month edge still shows. Soft-deleted requests are never returned. Dates come back as text so
 * postgres.js never turns them into timezone-shifting Date objects.
 */
export type CalendarQuery = {
  role: UserRole;
  userId: string;
  from: IsoDate;
  to: IsoDate;
  /** Include rejected requests (the "Show rejected and cancelled" toggle). */
  includeRejected: boolean;
};

type Row = {
  id: string;
  user_id: string;
  user_name: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  status: CalendarStatus;
};

export async function getCalendarRequests(
  sql: Sql,
  { role, userId, from, to, includeRejected }: CalendarQuery,
): Promise<CalendarRequest[]> {
  const rows =
    role === "hr_admin"
      ? await sql<Row[]>`
          select r.id, r.user_id, u.name as user_name, lt.name as leave_type_name,
                 r.start_date::text as start_date, r.end_date::text as end_date, r.status
          from public.leave_requests r
          join public.users u on u.id = r.user_id
          join public.leave_types lt on lt.id = r.leave_type_id
          where r.is_deleted = false
            and (r.status in ('pending', 'approved') or (${includeRejected}::boolean and r.status = 'rejected'))
            and r.start_date <= ${to}::date and r.end_date >= ${from}::date
          order by r.start_date, r.id`
      : role === "manager"
        ? await sql<Row[]>`
            select r.id, r.user_id, u.name as user_name, lt.name as leave_type_name,
                   r.start_date::text as start_date, r.end_date::text as end_date, r.status
            from public.leave_requests r
            join public.users u on u.id = r.user_id
            join public.leave_types lt on lt.id = r.leave_type_id
            where (r.user_id = ${userId} or u.manager_id = ${userId})
              and r.is_deleted = false
              and (r.status in ('pending', 'approved') or (${includeRejected}::boolean and r.status = 'rejected'))
              and r.start_date <= ${to}::date and r.end_date >= ${from}::date
            order by r.start_date, r.id`
        : await sql<Row[]>`
            select r.id, r.user_id, u.name as user_name, lt.name as leave_type_name,
                   r.start_date::text as start_date, r.end_date::text as end_date, r.status
            from public.leave_requests r
            join public.users u on u.id = r.user_id
            join public.leave_types lt on lt.id = r.leave_type_id
            where r.user_id = ${userId}
              and r.is_deleted = false
              and (r.status in ('pending', 'approved') or (${includeRejected}::boolean and r.status = 'rejected'))
              and r.start_date <= ${to}::date and r.end_date >= ${from}::date
            order by r.start_date, r.id`;

  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    leaveTypeName: row.leave_type_name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
  }));
}
