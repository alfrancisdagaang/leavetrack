-- LeaveTrack — development / demo seed data. Idempotent: safe to run any number of times.
-- Everything here is FAKE demo data. Fixed UUIDs match src/lib/mock/users.ts.
--
-- Org chart (exercises US-03/US-04 scoping from day one):
--   Sam Okafor (hr_admin)           ← approves Hana's own leave (nobody can be their own approver)
--   └── Hana Reyes (hr_admin)       ← mock "hr_admin" session
--       ├── Marco Santos (manager)  ← mock "manager" session
--       │   ├── Elena Cruz (employee)   ← mock "employee" session
--       │   └── Jun Bautista (employee)
--       └── Priya Nair (manager)
--           └── Leo Garcia (employee)   ← OTHER team: must never appear in Marco's queue

-- Leave types (Vacation/Sick/Unpaid) are reference data: they ship in
-- migrations/20261014000000_seed_leave_types.sql, not here.

-- Insert parents before children (manager_id FK).
insert into public.users (id, name, email, role, manager_id) values
  ('00000000-0000-4000-8000-000000000007', 'Sam Okafor',   'sam.okafor@leavetrack.example',   'hr_admin', null),
  ('00000000-0000-4000-8000-000000000001', 'Hana Reyes',   'hana.reyes@leavetrack.example',   'hr_admin', '00000000-0000-4000-8000-000000000007'),
  ('00000000-0000-4000-8000-000000000002', 'Marco Santos', 'marco.santos@leavetrack.example', 'manager',  '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000004', 'Priya Nair',   'priya.nair@leavetrack.example',   'manager',  '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000003', 'Elena Cruz',   'elena.cruz@leavetrack.example',   'employee', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000005', 'Jun Bautista', 'jun.bautista@leavetrack.example', 'employee', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000006', 'Leo Garcia',   'leo.garcia@leavetrack.example',   'employee', '00000000-0000-4000-8000-000000000004')
on conflict (id) do nothing;

-- Databases seeded before Sam existed have Hana at the top with no approver. `on conflict do
-- nothing` cannot change an existing row, so point her at Sam explicitly (a no-op on re-runs).
update public.users
set manager_id = '00000000-0000-4000-8000-000000000007'
where id = '00000000-0000-4000-8000-000000000001' and manager_id is null;

-- Roles stack (managers and HR admins also request leave), so every user gets the demo policy:
-- 1.25 days/month Vacation, 1.00 day/month Sick. Unpaid has no policy and no balance.
insert into public.leave_policies (user_id, leave_type_id, accrual_per_month)
select u.id, t.id, case t.name when 'Vacation' then 1.25 else 1.00 end
from public.users u
cross join public.leave_types t
where t.tracks_balance
on conflict (user_id, leave_type_id) do nothing;

-- Demo opening balances (10 Vacation / 5 Sick) for every balance-tracked type.
insert into public.leave_balances (user_id, leave_type_id, balance)
select u.id, t.id, case t.name when 'Vacation' then 10.00 else 5.00 end
from public.users u
cross join public.leave_types t
where t.tracks_balance
on conflict (user_id, leave_type_id) do nothing;

-- Demo pending requests so the approval queues are not empty (each with its `submitted` audit row):
--   Jun  (Marco's team)  → in Marco's queue
--   Leo  (Priya's team)  → must NEVER appear in Marco's queue
--   Marco (Hana's team)  → in Hana's queue
--   plus four more (Elena, Jun, Priya, Hana) so the October calendar has bars. Priya's and Hana's
--   go to Hana's and Sam's queues; Elena's and Jun's to Marco's.
insert into public.leave_requests (id, user_id, leave_type_id, start_date, end_date, reason) values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005',
   '10000000-0000-4000-8000-000000000001', date '2026-11-02', date '2026-11-04', 'Family trip (demo)'),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000006',
   '10000000-0000-4000-8000-000000000002', date '2026-11-09', date '2026-11-10', 'Medical appointment (demo)'),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002',
   '10000000-0000-4000-8000-000000000001', date '2026-11-16', date '2026-11-17', 'Long weekend (demo)'),
  -- Added for the demo calendar (TASK-027): pending, in October so the default month is not empty.
  ('30000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003',
   '10000000-0000-4000-8000-000000000001', date '2026-10-21', date '2026-10-23', 'Short break (demo)'),
  ('30000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005',
   '10000000-0000-4000-8000-000000000002', date '2026-10-26', date '2026-10-26', 'Dentist (demo)'),
  ('30000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000004',
   '10000000-0000-4000-8000-000000000001', date '2026-10-28', date '2026-10-29', 'Family visit (demo)'),
  ('30000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000001', date '2026-11-05', date '2026-11-06', 'Conference travel (demo)')
on conflict (id) do nothing;

insert into public.audit_log (id, leave_request_id, actor_id, action) values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000005', 'submitted'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-000000000006', 'submitted'),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003',
   '00000000-0000-4000-8000-000000000002', 'submitted'),
  ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004',
   '00000000-0000-4000-8000-000000000003', 'submitted'),
  ('40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000005',
   '00000000-0000-4000-8000-000000000005', 'submitted'),
  ('40000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000006',
   '00000000-0000-4000-8000-000000000004', 'submitted'),
  ('40000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000007',
   '00000000-0000-4000-8000-000000000001', 'submitted')
on conflict (id) do nothing;
