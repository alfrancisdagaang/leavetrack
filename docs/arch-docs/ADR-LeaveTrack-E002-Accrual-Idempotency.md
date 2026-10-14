# ADR-LeaveTrack-E002 — Accrual Idempotency

**Status:** Accepted (2026-10-14)

## Context
US-07 requires a monthly job that credits each employee's balance by their policy's `accrual_per_month`, and AC2 requires that running it again in the same month never double-accrues. BRD risk: "if accrual logic (BR-06) is wrong, every employee's balance is wrong."

Vercel Cron (checked against vercel.com/docs/cron-jobs, September 2026) behaves as follows:
- It calls the path with an HTTP **GET**, not POST, on the production deployment, with `Authorization: Bearer $CRON_SECRET`.
- Schedules are always **UTC**.
- Delivery is **best effort with no retries**: a run can be missed entirely, and the same run can occasionally be delivered more than once. Vercel's guidance is to make jobs idempotent and reconciliation-based, so each run safely catches up on outstanding work.
- Two runs can overlap if one is slow.

## Options Considered
1. **One row per month (`accrual_runs(period)`)** — insert the period, and if it already exists do nothing.
   - Pros: simplest.
   - Cons: an employee (or policy) added after the month's run never accrues for that month; no per-employee history.
2. **A `last_accrued` column on `leave_balances`.**
   - Pros: no new table.
   - Cons: a single date cannot represent a missed month in the middle; harder to audit; couples idempotency to a mutable balance row.
3. **An advisory lock around the job.**
   - Pros: prevents overlapping runs.
   - Cons: does not make a *repeated* run safe; the lock is released when the run ends.
4. **A per-employee, per-leave-type, per-month ledger with a unique key (chosen).**
   - Pros: idempotent per employee and month, handles late joiners and missed months, gives HR an accrual history.
   - Cons: one new table.

## Decision
Option 4. `accrual_ledger (user_id, leave_type_id, period, amount)` with `UNIQUE (user_id, leave_type_id, period)`, where `period` is the first day of a UTC month.

- The whole run is **one SQL statement**: insert the due ledger rows with `ON CONFLICT DO NOTHING`, then credit `leave_balances` from only the rows the ledger actually accepted (`INSERT ... ON CONFLICT DO UPDATE SET balance = balance + excluded.balance`). The ledger and the balances therefore commit or roll back together, and concurrent runs queue on the unique key, so only one credits a month.
- **Catch-up:** a run starts at the month after the latest ledger month (or at the current month if the latest *is* the current month) and accrues every month up to the current one. A missed run is repaired by the next. The **first ever** run accrues the current month only; there is no retroactive back-pay.
- **Late joiners:** re-running within the same month accrues any policy added since, because that month is re-evaluated and existing rows are skipped.
- Only leave types with `tracks_balance = true` accrue, so **Unpaid never does**.
- A missing balance row is created holding exactly the accrued amount (0 + accrual). This differs from approval (TASK-014), where nothing may be invented.
- Arithmetic is SQL `numeric` only, never JavaScript floats.
- The ledger is **append-only** (triggers block update, delete and truncate), the same protection as `audit_log`; deleting a ledger row would allow a double accrual.
- The route answers **GET** (Vercel Cron) and **POST** (manual runs, and the original spec), both behind the `CRON_SECRET` bearer check in `src/proxy.ts`, repeated inside the handler.
- Months are cut at **UTC** (`0 0 1 * *`).

## Consequences
- Positive: AC1 and AC2 hold by construction, including under duplicate or concurrent invocations; a missed month self-heals; HR can see exactly what was credited and when.
- Negative: a new table and trigger set; months follow UTC, so staff in other time zones may see the credit a few hours "early" or "late" on the 1st; a policy added mid-month earns the full month on the next run (no pro-rating).
- Out of scope (Sprint 2): mid-year policy changes, pro-rating, and an HR screen for the ledger.
- Demo note: the first scheduled run is 1 November 00:00 UTC. Before then, accrual is shown by triggering the route manually with the bearer secret, which credits the current month once.
