-- LeaveTrack — audit action for the HR override (EPIC-6, TASK-037).
-- When an HR Admin approves an over-balance request (PRD US-01 AC3), the decision is recorded as
-- 'override_approved' instead of 'approved', so the 3-year record (BR-04) shows it was an override.
--
-- Forward-only, and deliberately its own file: Postgres will not let a new enum value be used
-- in the transaction that adds it, and `supabase db push` may run a file as one transaction
-- while CI's psql runs it statement by statement. The CHECK that mentions this value is in
-- the next migration, which runs after this one has committed.
--
-- Enum values can never be removed, so this name is permanent once applied anywhere.
-- Nothing writes it until TASK-038, so adding it changes no behaviour.

alter type public.audit_action add value if not exists 'override_approved';
