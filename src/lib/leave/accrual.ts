import type { Sql } from "postgres";
import { logger } from "@/lib/logger";

/**
 * TASK-017 (US-07, ADR-LeaveTrack-E002). Monthly balance accrual.
 *
 * The whole run is ONE SQL statement, so the ledger rows and the balance changes commit or roll
 * back together. Idempotency comes from `accrual_ledger`'s unique (user, leave type, month) key:
 * a second run inserts no ledger rows, so it credits nothing. Concurrent runs queue on that key.
 * All arithmetic is SQL `numeric`; the app never adds balances as JavaScript numbers.
 */

export type AccrualResult = {
  /** The month the run is for, UTC, as YYYY-MM. */
  period: string;
  /** Months that were actually credited by this run (more than one means missed months were caught up). */
  periods_accrued: string[];
  /** New ledger rows written; 0 means this month was already fully accrued. */
  ledger_entries: number;
  /** Balance rows credited (or created). */
  balances_updated: number;
};

/** First day of `now`'s month in UTC, as YYYY-MM-DD. Months are cut at UTC (the cron schedule is UTC). */
export function monthStart(now: Date): string {
  const year = String(now.getUTCFullYear()).padStart(4, "0");
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export async function runAccrual(sql: Sql, now: Date): Promise<AccrualResult> {
  const current = monthStart(now);

  // Start month: the current month on the very first run (no back-pay); otherwise the month after
  // the latest recorded one, never later than the current month. When the latest recorded month IS
  // the current month this re-runs it, which is a no-op except for policies added since.
  // Only balance-tracked leave types accrue, so Unpaid never does. A missing balance row is
  // created holding exactly the accrued amount (0 + accrual).
  const [row] = await sql<{ ledger_rows: number; credited: number; periods: string[] }[]>`
    with bounds as (
      select ${current}::date as current_period,
             (select max(period) from public.accrual_ledger) as last_period
    ), start_period as (
      select case when last_period is null then current_period
                  else least((last_period + interval '1 month')::date, current_period)
             end as period
      from bounds
    ), periods as (
      select generate_series(s.period::timestamp, b.current_period::timestamp, interval '1 month')::date
               as period
      from start_period s, bounds b
    ), due as (
      select p.period, lp.user_id, lp.leave_type_id, lp.accrual_per_month as amount
      from periods p
      cross join public.leave_policies lp
      join public.leave_types lt on lt.id = lp.leave_type_id
      where lt.tracks_balance
    ), ledgered as (
      insert into public.accrual_ledger (user_id, leave_type_id, period, amount)
      select user_id, leave_type_id, period, amount from due
      on conflict (user_id, leave_type_id, period) do nothing
      returning user_id, leave_type_id, period, amount
    ), totals as (
      select user_id, leave_type_id, sum(amount) as amount
      from ledgered
      group by user_id, leave_type_id
    ), credited as (
      insert into public.leave_balances (user_id, leave_type_id, balance)
      select user_id, leave_type_id, amount from totals
      on conflict (user_id, leave_type_id)
      do update set balance = public.leave_balances.balance + excluded.balance, updated_at = now()
      returning user_id
    )
    select (select count(*) from ledgered)::int as ledger_rows,
           (select count(*) from credited)::int as credited,
           (select coalesce(array_agg(distinct to_char(period, 'YYYY-MM')
                                      order by to_char(period, 'YYYY-MM')), '{}'::text[])
            from ledgered) as periods`;

  const result: AccrualResult = {
    period: current.slice(0, 7),
    periods_accrued: row?.periods ?? [],
    ledger_entries: row?.ledger_rows ?? 0,
    balances_updated: row?.credited ?? 0,
  };
  logger.info(result, "Accrual run complete");
  return result;
}

/** The latest month the accrual has run for (YYYY-MM), or null if it has never run. */
export async function getLastAccrualPeriod(sql: Sql): Promise<string | null> {
  const [row] = await sql<{ period: string | null }[]>`
    select to_char(max(period), 'YYYY-MM') as period from public.accrual_ledger`;
  return row?.period ?? null;
}
