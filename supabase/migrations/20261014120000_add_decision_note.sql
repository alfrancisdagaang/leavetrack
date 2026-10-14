-- LeaveTrack — decision note on leave requests (TASK-014, US-03 AC2).
-- A rejection must carry a reason; approvals leave it null. The employee's own `reason`
-- stays in its own column, so the two never mix. audit_log is untouched (append-only).
--
-- Forward-only: this does not edit the init migration. No leave_requests row is
-- `rejected` anywhere yet, so adding the CHECK validates cleanly.

alter table public.leave_requests
  add column decision_note text;

alter table public.leave_requests
  add constraint leave_requests_decision_note_length
    check (decision_note is null or length(decision_note) <= 500),
  add constraint leave_requests_rejection_note
    check (status <> 'rejected' or (decision_note is not null and length(trim(decision_note)) > 0));
