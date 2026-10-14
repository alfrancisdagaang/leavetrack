# Retro — TASK-013 team queue + TASK-014 approve/reject (2026-10-14)

Scope: `GET /api/leave-requests?scope=team`, `POST /api/leave-requests/:id/decision`, `/approvals` page (pending queue plus
a small "recently decided" list), the `decision_note` migration, the seed fix (second `hr_admin`, balances for every
user, three demo pending requests), and AGENTS.md rule 11. Verified with the full gate (128 tests), a real Postgres 18
(21 checks through the real routes and SQL, harness deleted afterwards, throwaway database dropped), and the migration
and seed applied twice plus `verify_schema.sql` on a fresh database. No BLOCKER or FIX NOW issues found.

## Decisions taken (confirmed with the user)

- **Option A for over-balance approval:** approving a request that exceeds the employee's confirmed balance is refused with
  a 409; the manager can still reject. The PRD only says such a request "may still be submitted for HR override" and never
  defines the override, so nothing was invented: no negative balances, no balance rows created on approval.
- A missing balance row for a balance-tracked type also refuses the approval (409). Unpaid is recognised by
  `leave_types.tracks_balance = false`, never by name or by a missing row, and never touches `leave_balances`.
- A request that is missing, soft-deleted or from another team gets the same 403, so ids cannot be probed.

## Pattern worth reusing

- **Scoped decision:** one transaction; a lookup joined to `users` with `u.manager_id = $caller ... FOR UPDATE OF r`; the
  balance change as a single guarded `UPDATE ... WHERE balance >= $days`; the request update guarded by
  `status = 'pending'`; the audit row last. The lock plus the re-checked guard made concurrent approvals safe in the real-DB
  run (3 simultaneous approvals of one request: one 200, two 409, balance decremented once; two requests competing for the
  last days: exactly one wins).
- **Fake `sql` tag in unit tests:** a tiny recording function (`strings.join("?")`) lets tests assert the SQL shape (scope
  predicate, `for update`, no `leave_balances` touched for Unpaid) and the statement order without a database. It does not
  replace real-DB checks, it guards the scoping predicate against regressions.

## Backlog

- [ ] **HR override is still undefined.** Under option A an over-balance request can only be rejected. Raise with the
      supervisor: who may override, and may the balance go negative? Revisit before the real launch.
- [ ] **The UI was not looked at in a browser.** The new pages build and their queries run, but nobody has clicked
      Approve/Reject or checked 375px. Needs the user's `next start` (rebuild, restart).
- [ ] **Sam Okafor cannot log in** (the mock login only acts as Elena, Marco or Hana), so Hana's own requests stay pending in
      the demo UI. They can only be decided through the API as Sam, or after real auth.
- [ ] **Real-DB checks were a one-off harness again** (21 checks). Promote them to a gated integration test (e.g.
      `TEST_DATABASE_URL`) run in the CI `db-verify` job, which already has a Postgres service.
- [ ] **No page rendering tests** (`/approvals`, `approval-actions`): vitest runs in `node`; add jsdom + testing-library if UI
      logic grows.
- [ ] Nothing stops approving a request whose dates are already in the past (not in any AC).
- [ ] The dashboard does not show a pending-approvals count.
- [ ] Carry-over still open: validation messages show the raw zod path, dates show as ISO, no overlap detection between
      requests, active nav link, compact mobile header.
