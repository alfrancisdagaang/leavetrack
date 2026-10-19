-- Seed verification for the three-role model (EPIC-10, TASK-060). Run by CI after migrations and
-- the seed (applied twice) on a FRESH throwaway database:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/verify_seed.sql
-- Read-only. It checks what the seed creates, so it is expected to fail on a database seeded by an
-- older seed (managers and HR admins still hold balances and requests there; the seed never deletes).
-- The reporting-line checks also fail on a database that still has the old lines until the seed is run again.

do $$
declare
  n int;
begin
  -- AC1: only employees have leave. No policy, balance or request for a manager or HR admin.
  select count(*) into n from public.leave_policies p join public.users u on u.id = p.user_id
  where u.role <> 'employee';
  if n <> 0 then raise exception 'seed gave % leave policies to a manager or HR admin', n; end if;

  select count(*) into n from public.leave_balances b join public.users u on u.id = b.user_id
  where u.role <> 'employee';
  if n <> 0 then raise exception 'seed gave % leave balances to a manager or HR admin', n; end if;

  select count(*) into n from public.leave_requests r join public.users u on u.id = r.user_id
  where u.role <> 'employee';
  if n <> 0 then raise exception 'seed created % leave requests for a manager or HR admin', n; end if;

  -- Every employee still has a balance row for each tracked type (3 employees x 2 types)
  select count(*) into n from public.leave_balances b join public.users u on u.id = b.user_id
  where u.role = 'employee';
  if n <> 6 then raise exception 'expected 6 employee balances, found %', n; end if;

  -- The audit trail matches: one submitted row per demo request, none by a manager or HR admin
  select count(*) into n from public.leave_requests;
  if n <> 5 then raise exception 'expected 5 demo requests, found %', n; end if;
  select count(*) into n from public.audit_log a
  join public.users u on u.id = a.actor_id
  where a.action = 'submitted' and u.role <> 'employee';
  if n <> 0 then raise exception '% submitted audit rows are by a manager or HR admin', n; end if;
  select count(*) into n from public.audit_log;
  if n <> 5 then raise exception 'expected 5 audit rows, found %', n; end if;

  -- Reporting lines: manager_id is an employee's approver (BRD BR-02), so only employees have a
  -- manager. A manager or HR admin has none, and every employee reports to a manager.
  select count(*) into n from public.users
  where role in ('manager', 'hr_admin') and manager_id is not null;
  if n <> 0 then raise exception '% managers or HR admins have a manager', n; end if;

  select count(*) into n
  from public.users e left join public.users m on m.id = e.manager_id
  where e.role = 'employee' and (e.manager_id is null or m.role <> 'manager');
  if n <> 0 then raise exception '% employees have no manager, or a manager who is not a manager', n; end if;

  -- AC2: Leo is on another team. The team queue's scope (u.manager_id = Marco) finds Elena's and
  -- Jun's pending requests and never Leo's.
  select count(*) into n from public.users
  where id = '00000000-0000-4000-8000-000000000006'
    and manager_id = '00000000-0000-4000-8000-000000000004';
  if n <> 1 then raise exception 'Leo must report to Priya'; end if;

  select count(*) into n
  from public.leave_requests r join public.users u on u.id = r.user_id
  where u.manager_id = '00000000-0000-4000-8000-000000000002'
    and r.status = 'pending' and r.is_deleted = false
    and u.id = '00000000-0000-4000-8000-000000000006';
  if n <> 0 then raise exception 'Leo appears in Marco''s queue'; end if;

  select count(*) into n
  from public.leave_requests r join public.users u on u.id = r.user_id
  where u.manager_id = '00000000-0000-4000-8000-000000000002'
    and r.status = 'pending' and r.is_deleted = false;
  if n <> 4 then raise exception 'expected 4 pending requests in Marco''s queue, found %', n; end if;

  -- AC3: exactly one pending request is over its confirmed balance (the HR override queue's rule:
  -- balance-tracked type, a balance row, 0 <= balance < working days), and it is Elena's Sick.
  select count(*) into n
  from public.leave_requests r
  join public.leave_types lt on lt.id = r.leave_type_id and lt.tracks_balance
  join public.leave_balances lb on lb.user_id = r.user_id and lb.leave_type_id = r.leave_type_id
  cross join lateral (
    select count(*)::int as days
    from generate_series(r.start_date::timestamp, r.end_date::timestamp, interval '1 day') g
    where extract(isodow from g) < 6
  ) d
  where r.status = 'pending' and r.is_deleted = false
    and lb.balance >= 0 and lb.balance < d.days;
  if n <> 1 then raise exception 'expected exactly 1 over-balance pending request, found %', n; end if;

  select count(*) into n
  from public.leave_requests r
  join public.leave_balances lb on lb.user_id = r.user_id and lb.leave_type_id = r.leave_type_id
  where r.id = '30000000-0000-4000-8000-000000000008'
    and r.user_id = '00000000-0000-4000-8000-000000000003'
    and r.leave_type_id = '10000000-0000-4000-8000-000000000002'
    and r.status = 'pending'
    and lb.balance = 5
    and (select count(*) from generate_series(r.start_date::timestamp, r.end_date::timestamp,
                                              interval '1 day') g
         where extract(isodow from g) < 6) = 8;
  if n <> 1 then raise exception 'the override demo request is not Elena''s 8-day Sick request over a balance of 5'; end if;

  -- Elena's other pending request is Vacation and in balance: an override of the Sick request
  -- must not turn it over-balance (it is a different leave type).
  select count(*) into n from public.leave_requests
  where user_id = '00000000-0000-4000-8000-000000000003' and status = 'pending'
    and leave_type_id = '10000000-0000-4000-8000-000000000002';
  if n <> 1 then raise exception 'Elena must have exactly one pending Sick request'; end if;

  raise notice 'Seed verification passed';
end;
$$;
