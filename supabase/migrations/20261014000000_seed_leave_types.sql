-- LeaveTrack — reference data: leave types (TASK-010 AC3).
-- Reference data ships as a migration, not only in seed.sql: `supabase db push` does not run
-- the seed, so a database built from migrations alone would have no leave types and no
-- request could ever be created. Fixed IDs are the ones previously inserted by seed.sql.
-- Idempotent: safe to run on a database that already has these rows.

insert into public.leave_types (id, name, tracks_balance) values
  ('10000000-0000-4000-8000-000000000001', 'Vacation', true),
  ('10000000-0000-4000-8000-000000000002', 'Sick',     true),
  ('10000000-0000-4000-8000-000000000003', 'Unpaid',   false)
on conflict (id) do nothing;
