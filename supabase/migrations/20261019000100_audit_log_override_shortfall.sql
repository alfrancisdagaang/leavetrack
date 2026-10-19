-- LeaveTrack — shortfall record for the HR override (EPIC-6, TASK-037).
-- Runs after 20261019000000_add_override_approved_action.sql has committed, so the new enum
-- value can be used here.
--
-- Forward-only: the init migration is not edited, and leave_requests is not touched. No existing
-- row is rewritten: the columns are nullable and no existing audit row uses the new action, so the
-- CHECK holds. The append-only triggers (row-level update/delete, truncate) are not involved.

-- Why an override was needed, kept in the 3-year record (BR-04): the days asked for, the balance
-- at that moment and the days it fell short. Present exactly on 'override_approved' rows, absent
-- on every other action.
alter table public.audit_log
  add column days_requested numeric(6, 2),
  add column balance_before numeric(6, 2),
  add column shortfall      numeric(6, 2);

alter table public.audit_log
  add constraint audit_log_shortfall_consistent check (
    (
      action = 'override_approved'
      and days_requested is not null
      and balance_before is not null
      and shortfall is not null
      and balance_before >= 0
      and shortfall > 0
      and shortfall = days_requested - balance_before
    )
    or (
      action <> 'override_approved'
      and days_requested is null
      and balance_before is null
      and shortfall is null
    )
  );
