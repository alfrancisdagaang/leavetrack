# Retro: TASK-037, override_approved audit action and shortfall record (EPIC-6)

Schema only. Nothing writes `override_approved` until TASK-038, so no page or route behaves differently. This replaces the first attempt of the same day (a `pending_hr` status, an `escalated` action and a changed decision rule), which was dropped when the user decided on the simpler override: any HR Admin overrides a pending over-balance request, no new status, no "Send to HR" step (epic description in `docs/dev-tasks/epic-6-hr-override-tasks.csv`). The first attempt's migrations were never applied or committed, so they were reworked in place and renamed.

## What shipped

- `20261019000000_add_override_approved_action.sql`: `audit_action` gets `override_approved`. Its own file on purpose (see "Found").
- `20261019000100_audit_log_override_shortfall.sql`: `audit_log` gains nullable `days_requested`, `balance_before`, `shortfall`. `audit_log_shortfall_consistent` makes the three present exactly on `override_approved` rows (`balance_before >= 0`, `shortfall > 0`, `shortfall = days_requested - balance_before`) and null on every other action. `leave_requests` and its decision rule are untouched.
- `src/lib/db/types.ts`: `AUDIT_ACTIONS` gains `override_approved`; `AuditLogEntry` gains the three nullable fields. `LEAVE_STATUSES` is unchanged.
- `supabase/tests/verify_schema.sql` probes and `src/lib/db/override-schema.integration.test.ts` (gated, 3 tests, one per AC that needs a database).

## Found

- **A new enum value cannot be used in the transaction that adds it** (`unsafe use of new value`, reproduced in the first attempt). Hence two files. Pattern in `knowledge/patterns/implement-and-test.md`.
- **Enum values can never be removed.** `override_approved` is permanent once applied anywhere, including staging through the `db-push` job on the next push to `main`.
- **pglite-socket mixes up results after any SQL error**; real Postgres binaries from `embedded-postgres` (PostgreSQL 18.4, in the scratchpad) do not. Pattern added.
- **Permission denials during the rework.** A `git checkout --` that discards uncommitted edits was denied until the user approved it; an `rm -rf $VAR/...` was denied by a safety check (the directories did not exist, so the `rm` was dropped). Neither was worked around.

## Validation

- Real PostgreSQL 18.4: both new migrations applied after the four existing ones, each file as one simple query; seed applied twice with identical counts (7 users, 7 requests, 7 audit rows, 14 balances); `verify_schema.sql` printed "Schema verification passed"; gated test 3/3.
- Break-it proofs, all caught: the shortfall arithmetic removed (verify script fails on "an inconsistent shortfall was not blocked", gated AC2 fails); the "absent on other actions" half removed (verify script fails on "shortfall figures on a submitted row", gated AC2 fails); `override_approved` removed from `types.ts` (gated AC3 fails). `types.ts` restored and compared byte for byte.
- Full quality gate: lint, format:check (after one Prettier fix to the new test file), typecheck, 766 tests passed (74 skipped without a database), and `npm run build` passed in a throwaway copy (port 3000 was free; a symlinked `node_modules` breaks Turbopack, so the copy needs a real one). The gated test passed 3/3 again after the formatting change.

## Acceptance criteria

AC1 `override_approved` accepted, no `pending_hr` or `escalated` value: PASS (gated test, verify script). AC2 shortfall stored on override rows only, consistent, append-only triggers still reject update and delete: PASS. AC3 `types.ts` mirrors the migration, schema verification passes: PASS locally; **GitHub Actions not seen** (`gh` is not installed). AC4 seed twice with no change: PASS (`seed.sql` untouched).

## Deviations from the plan

- The plan said a search for `pending_hr`, `escalated` and `Waiting for HR` in `src` and `supabase` must find nothing. It finds three lines, all in the gated test, which asserts those values do **not** exist (AC1). Intended.
- The over-balance demo request in `seed.sql` was **not** added (it would change Marco's demo queue and tests that count it). It belongs to TASK-041.

## For TASK-038

- The audit CHECK needs `balance_before >= 0`, but `leave_balances` has no such constraint. A negative balance row would make the override insert fail with a constraint error, so TASK-038 must refuse that case with a clear message.
- Authorization stays in SQL: HR overrides only a pending request that is not their own and whose days exceed the balance; never trust a client id.

## Backlog

- `docs/arch-docs/ARCH-LeaveTrack-v1.0.md` is not edited (docs rule).
- Mark TASK-037 `Done` in the CSV only when asked.
- GitHub Actions on the real server is the final check for the two migrations. Do not push until the name `override_approved` is agreed.
