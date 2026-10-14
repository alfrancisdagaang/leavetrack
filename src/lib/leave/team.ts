import type { Sql } from "postgres";
import type { LeaveRequest } from "@/lib/db/types";
import { countWorkingDays } from "@/lib/leave/working-days";

/**
 * TASK-013 (US-04). A manager's view of their own team's requests.
 * Scope lives in the SQL (AGENTS.md rule 3): `u.manager_id = ${managerId}` is part of the query,
 * and nothing is fetched broadly and filtered in TypeScript. A request stores no manager, so when
 * an employee moves to another manager their pending requests move with them (US-04 AC2).
 */

export type TeamRequestView = {
  id: string;
  employee_name: string;
  leave_type_id: string;
  leave_type_name: string;
  tracks_balance: boolean;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveRequest["status"];
  created_at: Date;
  working_days: number;
  /** The employee's confirmed balance for this type; null for untracked types or a missing row. */
  balance: number | null;
  /** True when approving would be refused: tracked type and no row or too few days (option A). */
  insufficient: boolean;
};

type TeamRow = Omit<TeamRequestView, "working_days" | "balance" | "insufficient"> & {
  balance: string | null;
};

export async function getTeamQueue(sql: Sql, managerId: string): Promise<TeamRequestView[]> {
  const rows = await sql<TeamRow[]>`
    select r.id, u.name as employee_name, r.leave_type_id, lt.name as leave_type_name,
           lt.tracks_balance, r.start_date::text as start_date, r.end_date::text as end_date,
           r.reason, r.status, r.created_at, lb.balance
    from public.leave_requests r
    join public.users u on u.id = r.user_id
    join public.leave_types lt on lt.id = r.leave_type_id
    left join public.leave_balances lb
      on lb.user_id = r.user_id and lb.leave_type_id = r.leave_type_id
    where u.manager_id = ${managerId} and r.status = 'pending' and r.is_deleted = false
    order by r.created_at`;

  return rows.map((row) => {
    const days = countWorkingDays(row.start_date, row.end_date);
    const balance = row.tracks_balance && row.balance !== null ? Number(row.balance) : null;
    return {
      ...row,
      working_days: days,
      balance,
      insufficient: row.tracks_balance && (balance === null || balance < days),
    };
  });
}

export type DecidedTeamRequestView = {
  id: string;
  employee_name: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  status: LeaveRequest["status"];
  decision_note: string | null;
  decided_at: Date;
  working_days: number;
};

/**
 * Secondary list under the pending queue: the team's most recent decisions. Same SQL scope as
 * the queue (the caller's direct reports only), capped at 10.
 */
export async function getRecentlyDecided(
  sql: Sql,
  managerId: string,
): Promise<DecidedTeamRequestView[]> {
  const rows = await sql<Omit<DecidedTeamRequestView, "working_days">[]>`
    select r.id, u.name as employee_name, lt.name as leave_type_name,
           r.start_date::text as start_date, r.end_date::text as end_date,
           r.status, r.decision_note, r.decided_at
    from public.leave_requests r
    join public.users u on u.id = r.user_id
    join public.leave_types lt on lt.id = r.leave_type_id
    where u.manager_id = ${managerId} and r.status <> 'pending' and r.is_deleted = false
    order by r.decided_at desc
    limit 10`;
  return rows.map((row) => ({
    ...row,
    working_days: countWorkingDays(row.start_date, row.end_date),
  }));
}
