-- LeaveTrack — leave policy change history (EPIC-13, TASK-070).
-- Mirrored in src/lib/db/types.ts — keep both in lockstep.
--
-- BRD: "Leave policies (accrual rate per leave type) are configured by HR". `leave_policies` holds the
-- CURRENT rate and is edited in place, so this table is the record of who changed what: one row per
-- change, written in the same statement as the change. Forward-only: nothing existing is edited, no row
-- is rewritten, and the seed is untouched (the table starts empty).
--
-- `old_rate` is null when the employee had no policy for that leave type before. The upper bound of
-- `new_rate` (31 days a month) mirrors POLICY_RATE_MAX in src/lib/leave/policies-schema.ts.
--
-- Append-only, like accrual_ledger: a change record that could be edited or deleted would be no record.

create table public.leave_policy_changes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete restrict,
  leave_type_id  uuid not null references public.leave_types (id) on delete restrict,
  changed_by     uuid not null references public.users (id) on delete restrict,
  old_rate       numeric(6, 2),
  new_rate       numeric(6, 2) not null,
  changed_at     timestamptz not null default now(),
  constraint leave_policy_changes_old_rate_check check (old_rate is null or old_rate >= 0),
  constraint leave_policy_changes_new_rate_check check (new_rate >= 0 and new_rate <= 31),
  constraint leave_policy_changes_is_a_change check (old_rate is distinct from new_rate)
);

-- The "recent changes" list is company-wide, newest first; one person's history is read by user.
create index leave_policy_changes_changed_at_idx on public.leave_policy_changes (changed_at desc);
create index leave_policy_changes_user_changed_idx
  on public.leave_policy_changes (user_id, changed_at desc);

create function public.forbid_policy_change_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'leave_policy_changes is append-only — % is not allowed', tg_op
    using errcode = 'restrict_violation';
end;
$$;

create trigger leave_policy_changes_append_only
  before update or delete on public.leave_policy_changes
  for each row execute function public.forbid_policy_change_mutation();

create trigger leave_policy_changes_no_truncate
  before truncate on public.leave_policy_changes
  for each statement execute function public.forbid_policy_change_mutation();

-- Deny-by-default RLS, like every other table: the app connects server-side through the pooler and
-- only HR reads or writes this table (checked in SQL).
alter table public.leave_policy_changes enable row level security;
