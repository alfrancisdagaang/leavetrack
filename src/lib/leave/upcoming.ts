import type { Sql } from "postgres";
import type { UserRole } from "@/lib/db/types";
import type { IsoDate } from "@/lib/leave/calendar-layout";

/**
 * US-11. The next leave on the dashboard's "Upcoming leave" card. Scope is in the SQL
 * (AGENTS.md rule 3), chosen from the SERVER session, never from the client:
 *   - employee: only their own requests
 *   - manager:  their own and their direct reports' (`u.manager_id`)
 *   - hr_admin: everyone
 * Pending and approved only (rejected never), soft-deleted never, and only requests that have not
 * ended by `today`, so one that is under way still shows. Soonest first. Dates come back as text.
 */
export const UPCOMING_LIMIT = 5;

export type UpcomingQuery = {
  role: UserRole;
  userId: string;
  today: IsoDate;
};

export type UpcomingLeave = {
  id: string;
  userId: string;
  userName: string;
  leaveTypeName: string;
  startDate: IsoDate;
  endDate: IsoDate;
  status: "pending" | "approved";
};

type Row = {
  id: string;
  user_id: string;
  user_name: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  status: UpcomingLeave["status"];
};

export async function getUpcomingLeave(
  sql: Sql,
  { role, userId, today }: UpcomingQuery,
): Promise<UpcomingLeave[]> {
  const rows =
    role === "hr_admin"
      ? await sql<Row[]>`
          select r.id, r.user_id, u.name as user_name, lt.name as leave_type_name,
                 r.start_date::text as start_date, r.end_date::text as end_date, r.status
          from public.leave_requests r
          join public.users u on u.id = r.user_id
          join public.leave_types lt on lt.id = r.leave_type_id
          where r.is_deleted = false
            and r.status in ('pending', 'approved')
            and r.end_date >= ${today}::date
          order by r.start_date, r.id
          limit ${UPCOMING_LIMIT}`
      : role === "manager"
        ? await sql<Row[]>`
            select r.id, r.user_id, u.name as user_name, lt.name as leave_type_name,
                   r.start_date::text as start_date, r.end_date::text as end_date, r.status
            from public.leave_requests r
            join public.users u on u.id = r.user_id
            join public.leave_types lt on lt.id = r.leave_type_id
            where (r.user_id = ${userId} or u.manager_id = ${userId})
              and r.is_deleted = false
              and r.status in ('pending', 'approved')
              and r.end_date >= ${today}::date
            order by r.start_date, r.id
            limit ${UPCOMING_LIMIT}`
        : await sql<Row[]>`
            select r.id, r.user_id, u.name as user_name, lt.name as leave_type_name,
                   r.start_date::text as start_date, r.end_date::text as end_date, r.status
            from public.leave_requests r
            join public.users u on u.id = r.user_id
            join public.leave_types lt on lt.id = r.leave_type_id
            where r.user_id = ${userId}
              and r.is_deleted = false
              and r.status in ('pending', 'approved')
              and r.end_date >= ${today}::date
            order by r.start_date, r.id
            limit ${UPCOMING_LIMIT}`;

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
