-- LeaveTrack — development / demo seed data. Idempotent: safe to run any number of times.
-- Everything here is FAKE demo data. Fixed UUIDs match src/lib/mock/users.ts.
--
-- Three roles (EPIC-10): only Employees request leave, hold a balance and a leave policy; Managers
-- approve their direct reports' requests; HR admins run overrides and audits and have no team.
-- So the rows below that are about leave (policies, balances, requests) belong to employees only.
--
-- Org chart (exercises US-03/US-04 scoping from day one). `manager_id` is an EMPLOYEE's approver
-- (BRD BR-02, PRD US-03/US-04, ARCH): only employees have a manager. Managers and HR admins have
-- none, so nobody sits above them in the organization chart (EPIC-11):
--   Marco Santos (manager)          ← mock "manager" session
--   ├── Elena Cruz (employee)       ← mock "employee" session
--   └── Jun Bautista (employee)
--   Priya Nair (manager)
--   └── Leo Garcia (employee)       ← OTHER team: must never appear in Marco's queue
--   Hana Reyes (hr_admin)           ← mock "hr_admin" session; no manager, no team
--   Sam Okafor (hr_admin)           ← second HR admin (not a mock login); no manager, no team

-- Leave types (Vacation/Sick/Unpaid) are reference data: they ship in
-- migrations/20261014000000_seed_leave_types.sql, not here.

-- Insert parents before children (manager_id FK).
insert into public.users (id, name, email, role, manager_id) values
  ('00000000-0000-4000-8000-000000000007', 'Sam Okafor',   'sam.okafor@leavetrack.example',   'hr_admin', null),
  ('00000000-0000-4000-8000-000000000001', 'Hana Reyes',   'hana.reyes@leavetrack.example',   'hr_admin', null),
  ('00000000-0000-4000-8000-000000000002', 'Marco Santos', 'marco.santos@leavetrack.example', 'manager',  null),
  ('00000000-0000-4000-8000-000000000004', 'Priya Nair',   'priya.nair@leavetrack.example',   'manager',  null),
  ('00000000-0000-4000-8000-000000000003', 'Elena Cruz',   'elena.cruz@leavetrack.example',   'employee', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000005', 'Jun Bautista', 'jun.bautista@leavetrack.example', 'employee', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000006', 'Leo Garcia',   'leo.garcia@leavetrack.example',   'employee', '00000000-0000-4000-8000-000000000004')
on conflict (id) do nothing;

-- Older seeds put Hana under Sam and Marco and Priya under Hana (the roles-stack model, now gone).
-- `on conflict do nothing` cannot change an existing row, so clear those three explicitly (a no-op
-- on re-runs). It names the three seed ids only: nobody else's manager is touched. Do NOT add an
-- update here that sets a manager on a manager or HR admin: it would run on every seed.
update public.users
set manager_id = null
where id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004') and manager_id is not null;

-- Only employees have leave, so only employees get the demo policy: 1.25 days/month Vacation,
-- 1.00 day/month Sick. Unpaid has no policy and no balance. Rows that an older seed created for
-- managers and HR admins are left alone (nothing is deleted).
insert into public.leave_policies (user_id, leave_type_id, accrual_per_month)
select u.id, t.id, case t.name when 'Vacation' then 1.25 else 1.00 end
from public.users u
cross join public.leave_types t
where t.tracks_balance and u.role = 'employee'
on conflict (user_id, leave_type_id) do nothing;

-- Demo opening balances (10 Vacation / 5 Sick) for every balance-tracked type, employees only.
insert into public.leave_balances (user_id, leave_type_id, balance)
select u.id, t.id, case t.name when 'Vacation' then 10.00 else 5.00 end
from public.users u
cross join public.leave_types t
where t.tracks_balance and u.role = 'employee'
on conflict (user_id, leave_type_id) do nothing;

-- Demo pending requests, all from employees, each with its `submitted` audit row:
--   Jun  (Marco's team)  → in Marco's queue
--   Leo  (Priya's team)  → must NEVER appear in Marco's queue
--   Elena, Jun           → October requests so the default calendar month has bars
--   Elena, Sick          → OVER her balance (8 working days against 5): Marco sees "Waiting for HR
--                          override" with Reject only, and HR can override it. Her only other
--                          pending request is Vacation, so an override (which zeroes the Sick
--                          balance) does not turn it over-balance too. 8 days stays over balance
--                          even after a couple of monthly accruals.
-- Ids 03, 06 and 07 (requests from Marco, Priya and Hana in the older seed) are retired: managers
-- and HR admins no longer request leave. Do not reuse them; a database seeded earlier keeps them.
insert into public.leave_requests (id, user_id, leave_type_id, start_date, end_date, reason) values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005',
   '10000000-0000-4000-8000-000000000001', date '2026-11-02', date '2026-11-04', 'Family trip (demo)'),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000006',
   '10000000-0000-4000-8000-000000000002', date '2026-11-09', date '2026-11-10', 'Medical appointment (demo)'),
  -- Pending, in October so the default month is not empty (TASK-027).
  ('30000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000001', date '2026-10-21', date '2026-10-23', 'Short break (demo)'),
  ('30000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005',
   '10000000-0000-4000-8000-000000000002', date '2026-10-26', date '2026-10-26', 'Dentist (demo)'),
  -- Over balance, for the HR override demo (TASK-060): Mon 23 Nov to Wed 2 Dec is 8 working days.
  ('30000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000002', date '2026-11-23', date '2026-12-02', 'Flu recovery, over balance (demo)')
on conflict (id) do nothing;

insert into public.audit_log (id, leave_request_id, actor_id, action) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000005', 'submitted'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-000000000006', 'submitted'),
  ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004',
   '00000000-0000-4000-8000-000000000003', 'submitted'),
  ('40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000005',
   '00000000-0000-4000-8000-000000000005', 'submitted'),
  ('40000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000008',
   '00000000-0000-4000-8000-000000000003', 'submitted')
on conflict (id) do nothing;
