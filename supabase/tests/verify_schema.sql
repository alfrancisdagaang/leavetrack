-- Schema verification, run by CI after migrations + seed (applied twice).
-- Run with: psql -v ON_ERROR_STOP=1 -f supabase/tests/verify_schema.sql
-- Leaves the database unchanged (all probes roll back).

do $$
declare
  n int;
  req_id uuid;
begin
  -- 7 domain tables exist
  select count(*) into n from information_schema.tables
  where table_schema = 'public'
    and table_name in ('users','leave_types','leave_policies','leave_balances','leave_requests','audit_log','accrual_ledger');
  if n <> 7 then raise exception 'expected 7 tables, found %', n; end if;

  -- Seed idempotent: exactly 3 leave types, 7 users
  select count(*) into n from public.leave_types;
  if n <> 3 then raise exception 'expected 3 leave_types, found %', n; end if;
  select count(*) into n from public.leave_types
  where (id, name, tracks_balance) in (
    ('10000000-0000-4000-8000-000000000001'::uuid, 'Vacation', true),
    ('10000000-0000-4000-8000-000000000002'::uuid, 'Sick',     true),
    ('10000000-0000-4000-8000-000000000003'::uuid, 'Unpaid',   false));
  if n <> 3 then raise exception 'leave_types ids/names/tracks_balance do not match the spec'; end if;
  select count(*) into n from public.users;
  if n <> 7 then raise exception 'expected 7 users, found %', n; end if;

  -- Hana (top of the org chart) has an approver: a second hr_admin, never herself
  select count(*) into n from public.users h
  join public.users s on s.id = h.manager_id
  where h.id = '00000000-0000-4000-8000-000000000001' and s.role = 'hr_admin';
  if n <> 1 then raise exception 'Hana must have a second hr_admin as her manager'; end if;

  -- RLS enabled everywhere
  select count(*) into n from pg_tables
  where schemaname = 'public' and rowsecurity
    and tablename in ('users','leave_types','leave_policies','leave_balances','leave_requests','audit_log','accrual_ledger');
  if n <> 7 then raise exception 'expected RLS on 7 tables, found %', n; end if;

  -- is_deleted defaults to false
  insert into public.leave_requests (user_id, leave_type_id, start_date, end_date, reason)
  values ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
          date '2026-11-02', date '2026-11-03', 'verify')
  returning id into req_id;
  if (select is_deleted from public.leave_requests where id = req_id) then
    raise exception 'is_deleted should default to false';
  end if;

  -- end_date < start_date rejected (US-01 AC2)
  begin
    insert into public.leave_requests (user_id, leave_type_id, start_date, end_date)
    values ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
            date '2026-11-05', date '2026-11-04');
    raise exception 'date range check did not fire';
  exception when check_violation then null;
  end;

  -- Hard delete blocked (BR-04)
  begin
    delete from public.leave_requests where id = req_id;
    raise exception 'hard delete was not blocked';
  exception when restrict_violation then null;
  end;

  -- audit_log append-only (BR-04)
  insert into public.audit_log (leave_request_id, actor_id, action)
  values (req_id, '00000000-0000-4000-8000-000000000003', 'submitted');
  begin
    update public.audit_log set action = 'approved' where leave_request_id = req_id;
    raise exception 'audit_log update was not blocked';
  exception when restrict_violation then null;
  end;

  -- decision_note: a rejection must carry a reason (US-03 AC2); approvals need none
  begin
    update public.leave_requests
    set status = 'rejected', decided_by = '00000000-0000-4000-8000-000000000002', decided_at = now()
    where id = req_id;
    raise exception 'rejection without a decision_note was not blocked';
  exception when check_violation then null;
  end;
  update public.leave_requests
  set status = 'rejected', decided_by = '00000000-0000-4000-8000-000000000002', decided_at = now(),
      decision_note = 'Team is short'
  where id = req_id;
  if (select decision_note from public.leave_requests where id = req_id) <> 'Team is short' then
    raise exception 'decision_note was not stored';
  end if;

  -- accrual_ledger (ADR-LeaveTrack-E002): first-of-month only, one row per user/type/month, append-only
  insert into public.accrual_ledger (user_id, leave_type_id, period, amount)
  values ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
          date '2026-11-01', 1.25);
  begin
    insert into public.accrual_ledger (user_id, leave_type_id, period, amount)
    values ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
            date '2026-11-01', 1.25);
    raise exception 'a second accrual for the same month was not blocked';
  exception when unique_violation then null;
  end;
  begin
    insert into public.accrual_ledger (user_id, leave_type_id, period, amount)
    values ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002',
            date '2026-11-15', 1.00);
    raise exception 'a mid-month accrual period was not blocked';
  exception when check_violation then null;
  end;
  begin
    update public.accrual_ledger set amount = 99
    where user_id = '00000000-0000-4000-8000-000000000003';
    raise exception 'accrual_ledger update was not blocked';
  exception when restrict_violation then null;
  end;
  begin
    delete from public.accrual_ledger
    where user_id = '00000000-0000-4000-8000-000000000003';
    raise exception 'accrual_ledger delete was not blocked';
  exception when restrict_violation then null;
  end;

  -- Undo probe rows (aborts the whole DO block's writes)
  raise exception using errcode = 'P0001', message = 'VERIFY_OK';
exception
  when sqlstate 'P0001' then
    if sqlerrm <> 'VERIFY_OK' then raise; end if;
    raise notice 'Schema verification passed';
end;
$$;
