# Retro — TASK-011 submit + TASK-012 balance (2026-10-14)

Scope: `POST/GET /api/leave-requests`, `/requests/new`, `/balance`, `src/lib/leave/*`, nav flags and dashboard "Open"
buttons. Verified with the full gate (92 tests), a throwaway Postgres 18 (migrations + seed) driving the real route and
service (10 checks, harness deleted afterwards), a production build served against that database, and 375 / 320 / 1280px
screenshots (no horizontal overflow). No BLOCKER or FIX NOW issues found.

## Learned

- **postgres.js returns `date` columns as JS `Date` objects, but `src/lib/db/types.ts` declares them `string`.** The leave
  queries select `start_date::text` to stay timezone-safe. Do the same in every later query that reads `date` columns
  (TASK-013 / 014 / 015), or the declared type lies.
- Over-balance = requested working days > (confirmed balance − this user's other pending days). Pending days are derived,
  never stored (decision 14). Computed before the insert so a request never counts against itself.

## Backlog

- [ ] **Hana (top of the org chart) cannot submit leave**: `manager_id` is null, so the API answers 409 "No approver is
      assigned". Needs default 6 (a second `hr_admin`) in the seed.
- [ ] **Seed gives balances only to `role = 'employee'`**: managers and HR see "No balance set up yet". Extend the seed.
- [ ] **Validation messages are technical** (`end_date: must not be before the start date`, the zod path is shown). Map
      them to friendly, per-field messages. The browser's `min` on the end date already blocks most cases.
- [ ] **Dates show as ISO** (`2026-10-26 to 2026-10-28`) on the balance page; format for people.
- [ ] **No overlap detection** between a new request and the user's existing pending/approved ones (not in any AC).
- [ ] **Route/service tests mock the database**: the real-DB checks were a one-off harness. Consider a gated integration
      test (e.g. `TEST_DATABASE_URL`) run in the CI `db-verify` job, which already has a Postgres service.
- [ ] **Add the rule to `AGENTS.md`** that leave mutations go through route handlers and server actions are only for
      session handling (discussed, not yet written; the user has not confirmed).
- [ ] Carry-over from the UI retro still open: active nav link, compact mobile header, component rendering tests.
