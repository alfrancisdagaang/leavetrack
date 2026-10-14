-- LeaveTrack — development seed data. Idempotent: safe to run any number of times.
-- Fixed UUIDs match src/lib/mock/users.ts.
--
-- Org chart (exercises US-04 scoping from day one):
--   Hana Reyes (hr_admin)
--   ├── Marco Santos (manager)      ← mock "manager" session
--   │   ├── Elena Cruz (employee)   ← mock "employee" session
--   │   └── Jun Bautista (employee)
--   └── Priya Nair (manager)
--       └── Leo Garcia (employee)   ← OTHER team: must never appear in Marco's queue

-- Leave types (Vacation/Sick/Unpaid) are reference data: they ship in
-- migrations/20261014000000_seed_leave_types.sql, not here.

-- Insert parents before children (manager_id FK).
insert into public.users (id, name, email, role, manager_id) values
  ('00000000-0000-4000-8000-000000000001', 'Hana Reyes',   'hana.reyes@leavetrack.example',   'hr_admin', null),
  ('00000000-0000-4000-8000-000000000002', 'Marco Santos', 'marco.santos@leavetrack.example', 'manager',  '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000004', 'Priya Nair',   'priya.nair@leavetrack.example',   'manager',  '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000003', 'Elena Cruz',   'elena.cruz@leavetrack.example',   'employee', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000005', 'Jun Bautista', 'jun.bautista@leavetrack.example', 'employee', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000006', 'Leo Garcia',   'leo.garcia@leavetrack.example',   'employee', '00000000-0000-4000-8000-000000000004')
on conflict (id) do nothing;

-- Policies: 1.25 days/month Vacation, 1.00 day/month Sick, for every employee.
insert into public.leave_policies (user_id, leave_type_id, accrual_per_month)
select u.id, t.id, case t.name when 'Vacation' then 1.25 else 1.00 end
from public.users u
cross join public.leave_types t
where u.role = 'employee' and t.tracks_balance
on conflict (user_id, leave_type_id) do nothing;

-- Opening balances for every balance-tracked type.
insert into public.leave_balances (user_id, leave_type_id, balance)
select u.id, t.id, case t.name when 'Vacation' then 10.00 else 5.00 end
from public.users u
cross join public.leave_types t
where u.role = 'employee' and t.tracks_balance
on conflict (user_id, leave_type_id) do nothing;
