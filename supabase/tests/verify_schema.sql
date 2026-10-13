-- Schema verification, run by CI after migrations + seed (applied twice).
-- Run with: psql -v ON_ERROR_STOP=1 -f supabase/tests/verify_schema.sql
-- Leaves the database unchanged (all probes roll back).

do $$
declare
  n int;
  req_id uuid;
begin
  -- 6 domain tables exist
  select count(*) into n from information_schema.tables
  where table_schema = 'public'
    and table_name in ('users','leave_types','leave_policies','leave_balances','leave_requests','audit_log');
  if n <> 6 then raise exception 'expected 6 tables, found %', n; end if;

  -- Seed idempotent: exactly 3 leave types, 6 users
  select count(*) into n from public.leave_types;
  if n <> 3 then raise exception 'expected 3 leave_types, found %', n; end if;
  select count(*) into n from public.users;
  if n <> 6 then raise exception 'expected 6 users, found %', n; end if;

  -- RLS enabled everywhere
  select count(*) into n from pg_tables
  where schemaname = 'public' and rowsecurity
    and tablename in ('users','leave_types','leave_policies','leave_balances','leave_requests','audit_log');
  if n <> 6 then raise exception 'expected RLS on 6 tables, found %', n; end if;

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

  -- Undo probe rows (aborts the whole DO block's writes)
  raise exception using errcode = 'P0001', message = 'VERIFY_OK';
exception
  when sqlstate 'P0001' then
    if sqlerrm <> 'VERIFY_OK' then raise; end if;
    raise notice 'Schema verification passed';
end;
$$;
