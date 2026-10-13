-- LeaveTrack — initial leave domain schema.
-- Source of truth: docs/arch-docs/ARCH-LeaveTrack-v1.0.md (Data Model).
-- Mirrored in src/lib/db/types.ts — keep both in lockstep.
--
-- Invariants enforced here (not just in app code):
--   * BR-04: leave_requests are never hard-deleted; audit_log is append-only.
--   * US-01 AC2: end_date >= start_date.
--   * Deny-by-default RLS: Supabase's public anon/authenticated roles see nothing.
--     The app connects server-side through the pooler and applies scoping in SQL.

create extension if not exists pgcrypto; -- gen_random_uuid() on Postgres < 13

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('employee', 'manager', 'hr_admin');
create type public.leave_status as enum ('pending', 'approved', 'rejected');
create type public.audit_action as enum ('submitted', 'approved', 'rejected', 'soft_deleted');

-- ---------------------------------------------------------------------------
-- users — manager_id is the sole source of truth for scoped visibility (US-04).
-- Separate from Supabase auth.users; Day 1 links the two.
-- ---------------------------------------------------------------------------
create table public.users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  email       text not null,
  role        public.user_role not null,
  manager_id  uuid references public.users (id) on delete restrict,
  constraint users_not_own_manager check (manager_id is null or manager_id <> id)
);
create unique index users_email_lower_key on public.users (lower(email));
create index users_manager_id_idx on public.users (manager_id);

-- ---------------------------------------------------------------------------
-- leave_types — seeded: Vacation, Sick, Unpaid (Unpaid does not track balance).
-- ---------------------------------------------------------------------------
create table public.leave_types (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  tracks_balance  boolean not null
);

-- ---------------------------------------------------------------------------
-- leave_policies — accrual rate per user per leave type (US-07).
-- ---------------------------------------------------------------------------
create table public.leave_policies (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id) on delete restrict,
  leave_type_id      uuid not null references public.leave_types (id) on delete restrict,
  accrual_per_month  numeric(6, 2) not null check (accrual_per_month >= 0),
  constraint leave_policies_user_type_key unique (user_id, leave_type_id)
);

-- ---------------------------------------------------------------------------
-- leave_balances — one balance per user per leave type (US-02, US-08).
-- ---------------------------------------------------------------------------
create table public.leave_balances (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete restrict,
  leave_type_id  uuid not null references public.leave_types (id) on delete restrict,
  balance        numeric(6, 2) not null default 0,
  updated_at     timestamptz not null default now(),
  constraint leave_balances_user_type_key unique (user_id, leave_type_id)
);

-- ---------------------------------------------------------------------------
-- leave_requests — soft delete only (BR-04, 3-year retention).
-- ---------------------------------------------------------------------------
create table public.leave_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users (id) on delete restrict,
  leave_type_id  uuid not null references public.leave_types (id) on delete restrict,
  start_date     date not null,
  end_date       date not null,
  reason         text not null default '',
  status         public.leave_status not null default 'pending',
  decided_by     uuid references public.users (id) on delete restrict,
  decided_at     timestamptz,
  is_deleted     boolean not null default false,
  created_at     timestamptz not null default now(),
  constraint leave_requests_date_range check (end_date >= start_date),
  constraint leave_requests_decision_consistent check (
    (status = 'pending' and decided_by is null and decided_at is null)
    or (status <> 'pending' and decided_by is not null and decided_at is not null)
  )
);
create index leave_requests_user_status_active_idx
  on public.leave_requests (user_id, status)
  where is_deleted = false;

-- ---------------------------------------------------------------------------
-- audit_log — append-only decision record (BR-04, US-05).
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id                uuid primary key default gen_random_uuid(),
  leave_request_id  uuid not null references public.leave_requests (id) on delete restrict,
  actor_id          uuid not null references public.users (id) on delete restrict,
  action            public.audit_action not null,
  occurred_at       timestamptz not null default now()
);
create index audit_log_leave_request_id_idx on public.audit_log (leave_request_id);
create index audit_log_occurred_at_idx on public.audit_log (occurred_at);

-- ---------------------------------------------------------------------------
-- Guard triggers — retention rules hold even against ad-hoc SQL.
-- ---------------------------------------------------------------------------
create function public.forbid_hard_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'Hard delete is not allowed on %.% — use is_deleted (BR-04)',
    tg_table_schema, tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

create function public.forbid_audit_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only — % is not allowed (BR-04)', tg_op
    using errcode = 'restrict_violation';
end;
$$;

create trigger leave_requests_no_delete
  before delete on public.leave_requests
  for each row execute function public.forbid_hard_delete();

create trigger leave_requests_no_truncate
  before truncate on public.leave_requests
  for each statement execute function public.forbid_hard_delete();

create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.forbid_audit_mutation();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function public.forbid_audit_mutation();

-- ---------------------------------------------------------------------------
-- Row-level security: enabled, no policies → deny-by-default for API roles.
-- ---------------------------------------------------------------------------
alter table public.users          enable row level security;
alter table public.leave_types    enable row level security;
alter table public.leave_policies enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;
alter table public.audit_log      enable row level security;
