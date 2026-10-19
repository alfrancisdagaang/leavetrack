-- LeaveTrack — in-app notifications (EPIC-9, TASK-052).
-- Mirrored in src/lib/db/types.ts — keep both in lockstep.
--
-- PRD US-01 AC1 (the manager hears about a new request) and US-03 (the employee hears about the
-- decision). One row per person to tell. Forward-only: nothing existing is edited, no row is
-- rewritten, and the seed is untouched (the table starts empty).
--
-- No free text. The message is built at read time from `kind` and the request, so no reason, note or
-- name is copied into this table.
--
-- `kind` is text + CHECK, not an enum, on purpose: an enum value can never be removed. If a kind is
-- added, edit this list in a new migration AND NOTIFICATION_KINDS in src/lib/db/types.ts.

create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  recipient_id      uuid not null references public.users (id) on delete restrict,
  kind              text not null,
  leave_request_id  uuid not null references public.leave_requests (id) on delete restrict,
  created_at        timestamptz not null default now(),
  read_at           timestamptz,
  constraint notifications_kind_check
    check (kind in ('submitted', 'approved', 'rejected', 'overridden')),
  constraint notifications_read_after_created check (read_at is null or read_at >= created_at)
);

-- The bell's list and the unread count, both for one recipient, newest first.
create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

-- Retention: a notification is never hard-deleted or truncated (same guard as leave_requests, BR-04).
create trigger notifications_no_delete
  before delete on public.notifications
  for each row execute function public.forbid_hard_delete();

create trigger notifications_no_truncate
  before truncate on public.notifications
  for each statement execute function public.forbid_hard_delete();

-- The only allowed change is read_at going from null to a timestamp, once. Every other column is
-- fixed, and a read notification can neither be changed nor un-read.
create function public.guard_notification_update() returns trigger
language plpgsql as $$
begin
  if new.id is distinct from old.id
     or new.recipient_id is distinct from old.recipient_id
     or new.kind is distinct from old.kind
     or new.leave_request_id is distinct from old.leave_request_id
     or new.created_at is distinct from old.created_at then
    raise exception 'notifications are immutable except read_at'
      using errcode = 'restrict_violation';
  end if;
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'a notification can be marked read only once'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create trigger notifications_guard_update
  before update on public.notifications
  for each row execute function public.guard_notification_update();

-- Deny-by-default RLS, like every other table: the app connects server-side through the pooler and
-- scopes by recipient_id in SQL.
alter table public.notifications enable row level security;
