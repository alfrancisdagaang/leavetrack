-- Schema verification, run by CI after migrations + seed (applied twice).
-- Run with: psql -v ON_ERROR_STOP=1 -f supabase/tests/verify_schema.sql
-- Leaves the database unchanged (all probes roll back).

do $$
declare
  n int;
  req_id uuid;
begin
  -- 9 domain tables exist
  select count(*) into n from information_schema.tables
  where table_schema = 'public'
    and table_name in ('users','leave_types','leave_policies','leave_balances','leave_requests','audit_log','accrual_ledger','notifications','leave_policy_changes');
  if n <> 9 then raise exception 'expected 9 tables, found %', n; end if;

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

  -- Only employees have a manager (manager_id is an employee's approver, BRD BR-02): Hana, an HR
  -- admin, has none. The full reporting-line rules are in verify_seed.sql.
  select count(*) into n from public.users
  where id = '00000000-0000-4000-8000-000000000001' and role = 'hr_admin' and manager_id is null;
  if n <> 1 then raise exception 'Hana, an HR admin, must have no manager'; end if;

  -- RLS enabled everywhere
  select count(*) into n from pg_tables
  where schemaname = 'public' and rowsecurity
    and tablename in ('users','leave_types','leave_policies','leave_balances','leave_requests','audit_log','accrual_ledger','notifications','leave_policy_changes');
  if n <> 9 then raise exception 'expected RLS on 9 tables, found %', n; end if;

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

  -- HR override (EPIC-6, TASK-037): the shortfall is recorded exactly on override_approved rows
  insert into public.audit_log
    (leave_request_id, actor_id, action, days_requested, balance_before, shortfall)
  values (req_id, '00000000-0000-4000-8000-000000000001', 'override_approved', 10, 4, 6);
  if (select shortfall from public.audit_log
      where leave_request_id = req_id and action = 'override_approved') <> 6 then
    raise exception 'the shortfall was not stored';
  end if;
  begin
    insert into public.audit_log (leave_request_id, actor_id, action)
    values (req_id, '00000000-0000-4000-8000-000000000001', 'override_approved');
    raise exception 'override_approved without the shortfall figures was not blocked';
  exception when check_violation then null;
  end;
  begin
    insert into public.audit_log
      (leave_request_id, actor_id, action, days_requested, balance_before, shortfall)
    values (req_id, '00000000-0000-4000-8000-000000000001', 'override_approved', 10, 4, 5);
    raise exception 'an inconsistent shortfall was not blocked';
  exception when check_violation then null;
  end;
  begin
    insert into public.audit_log
      (leave_request_id, actor_id, action, days_requested, balance_before, shortfall)
    values (req_id, '00000000-0000-4000-8000-000000000001', 'override_approved', 3, -1, 4);
    raise exception 'a negative balance_before was not blocked';
  exception when check_violation then null;
  end;
  begin
    insert into public.audit_log
      (leave_request_id, actor_id, action, days_requested, balance_before, shortfall)
    values (req_id, '00000000-0000-4000-8000-000000000001', 'submitted', 10, 4, 6);
    raise exception 'shortfall figures on a submitted row were not blocked';
  exception when check_violation then null;
  end;
  begin
    update public.audit_log set shortfall = 1
    where leave_request_id = req_id and action = 'override_approved';
    raise exception 'audit_log update of the shortfall was not blocked';
  exception when restrict_violation then null;
  end;
  begin
    delete from public.audit_log
    where leave_request_id = req_id and action = 'override_approved';
    raise exception 'audit_log delete was not blocked';
  exception when restrict_violation then null;
  end;

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

  -- notifications (EPIC-9, TASK-052): fixed kinds, read once, never deleted
  insert into public.notifications (recipient_id, kind, leave_request_id)
  values ('00000000-0000-4000-8000-000000000002', 'submitted', req_id);
  begin
    insert into public.notifications (recipient_id, kind, leave_request_id)
    values ('00000000-0000-4000-8000-000000000002', 'bogus', req_id);
    raise exception 'an unknown notification kind was not blocked';
  exception when check_violation then null;
  end;
  begin
    update public.notifications set kind = 'approved'
    where leave_request_id = req_id;
    raise exception 'a notification kind change was not blocked';
  exception when restrict_violation then null;
  end;
  begin
    update public.notifications set recipient_id = '00000000-0000-4000-8000-000000000003'
    where leave_request_id = req_id;
    raise exception 'a notification recipient change was not blocked';
  exception when restrict_violation then null;
  end;
  update public.notifications set read_at = now() where leave_request_id = req_id;
  if (select read_at from public.notifications where leave_request_id = req_id) is null then
    raise exception 'read_at was not stored';
  end if;
  begin
    update public.notifications set read_at = null where leave_request_id = req_id;
    raise exception 'un-reading a notification was not blocked';
  exception when restrict_violation then null;
  end;
  begin
    update public.notifications set read_at = now() + interval '1 hour' where leave_request_id = req_id;
    raise exception 'marking a notification read twice was not blocked';
  exception when restrict_violation then null;
  end;
  begin
    delete from public.notifications where leave_request_id = req_id;
    raise exception 'notifications delete was not blocked';
  exception when restrict_violation then null;
  end;
  begin
    truncate public.notifications;
    raise exception 'notifications truncate was not blocked';
  exception when restrict_violation then null;
  end;

  -- leave_policy_changes (EPIC-13, TASK-070): a real change, bounded, append-only
  insert into public.leave_policy_changes (user_id, leave_type_id, changed_by, old_rate, new_rate)
  values ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000001', 1.25, 1.50);
  insert into public.leave_policy_changes (user_id, leave_type_id, changed_by, old_rate, new_rate)
  values ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000001', null, 1.00);
  begin
    insert into public.leave_policy_changes (user_id, leave_type_id, changed_by, old_rate, new_rate)
    values ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000001', 1.25, 32);
    raise exception 'a policy rate above 31 was not blocked';
  exception when check_violation then null;
  end;
  begin
    insert into public.leave_policy_changes (user_id, leave_type_id, changed_by, old_rate, new_rate)
    values ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000001', 1.25, -1);
    raise exception 'a negative policy rate was not blocked';
  exception when check_violation then null;
  end;
  begin
    insert into public.leave_policy_changes (user_id, leave_type_id, changed_by, old_rate, new_rate)
    values ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000001', 1.25, 1.25);
    raise exception 'a policy "change" to the same rate was not blocked';
  exception when check_violation then null;
  end;
  begin
    update public.leave_policy_changes set new_rate = 9
    where user_id = '00000000-0000-4000-8000-000000000003';
    raise exception 'leave_policy_changes update was not blocked';
  exception when restrict_violation then null;
  end;
  begin
    delete from public.leave_policy_changes
    where user_id = '00000000-0000-4000-8000-000000000003';
    raise exception 'leave_policy_changes delete was not blocked';
  exception when restrict_violation then null;
  end;
  begin
    truncate public.leave_policy_changes;
    raise exception 'leave_policy_changes truncate was not blocked';
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
