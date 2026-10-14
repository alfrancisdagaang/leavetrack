-- LeaveTrack — accrual ledger (TASK-017, US-07; see ADR-LeaveTrack-E002).
-- One row per employee, leave type and month records that the monthly accrual was applied.
-- The unique key is the idempotency guard: running the job again cannot credit a month twice,
-- and a missed run is caught up by the next one. The ledger is append-only for the same reason
-- audit_log is: deleting a row would allow a double accrual.
--
-- Forward-only: does not edit the init migration.

create table public.accrual_ledger (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete restrict,
  leave_type_id  uuid not null references public.leave_types (id) on delete restrict,
  -- First day of the accrued month, in UTC.
  period         date not null,
  -- What was credited, kept as the record of the policy rate used at the time.
  amount         numeric(6, 2) not null check (amount >= 0),
  created_at     timestamptz not null default now(),
  constraint accrual_ledger_period_first_of_month check (period = date_trunc('month', period)::date),
  constraint accrual_ledger_user_type_period_key unique (user_id, leave_type_id, period)
);
-- Catch-up looks up the latest recorded period.
create index accrual_ledger_period_idx on public.accrual_ledger (period);

create function public.forbid_ledger_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'accrual_ledger is append-only — % is not allowed (ADR-LeaveTrack-E002)', tg_op
    using errcode = 'restrict_violation';
end;
$$;

create trigger accrual_ledger_append_only
  before update or delete on public.accrual_ledger
  for each row execute function public.forbid_ledger_mutation();

create trigger accrual_ledger_no_truncate
  before truncate on public.accrual_ledger
  for each statement execute function public.forbid_ledger_mutation();

-- Deny-by-default RLS, like every other table: the app connects server-side through the pooler.
alter table public.accrual_ledger enable row level security;
