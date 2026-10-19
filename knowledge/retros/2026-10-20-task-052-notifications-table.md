# Retro: TASK-052, the notifications table (EPIC-9)

Not committed, not pushed. The migration reaches staging only on the next push to `main` (CI `db-push`).

## What shipped

- `supabase/migrations/20261020000000_notifications.sql`: `notifications` (id, recipient_id, kind, leave_request_id, created_at, read_at). Both FKs `on delete restrict`. No free text: the message is built at read time from kind and request.
- **`kind` is text + CHECK, not an enum** (`notifications_kind_check`: submitted, approved, rejected, overridden). An enum value can never be removed. The cost is that `NOTIFICATION_KINDS` in `src/lib/db/types.ts` and the CHECK list are kept in step by hand; `src/lib/db/notifications-schema.test.ts` fails if they drift.
- Indexes: `(recipient_id, created_at desc)` and a partial `(recipient_id, created_at desc) where read_at is null`. No index on `leave_request_id` (nothing filters on it).
- Guards: delete and truncate refused (reuses `forbid_hard_delete()`); `guard_notification_update()` allows only `read_at` null to a timestamp, once. RLS on, no policy.
- `verify_schema.sql`: table and RLS counts 7 to 8, plus probes for each rule. Without this CI `db-verify` would have failed.
- Seed untouched (the table starts empty); the CI "Seed twice" row-count step needs no change.

## Validation (real PostgreSQL 18.4, embedded, in the scratchpad)

- Migrations, seed twice, `verify_schema` and `verify_seed`: passed.
- `notifications-schema.integration.test.ts` (5 tests) on a fresh database: passed. It covers insert and read-once, other columns immutable, unknown kind refused, no delete or truncate, FKs restrict, and the unread read for one recipient uses `notifications_recipient_unread_idx` (`enable_seqscan = off`) and never returns another recipient's rows.
- **Mutation proofs, 7 copies, one rule weakened each:** no-delete trigger, no-truncate trigger, read-twice allowed, other columns mutable, kind CHECK dropped, unread index dropped, RLS off. Each was caught: six by a `verify_schema` probe with the matching message, the unread index by the gated EXPLAIN test (verify_schema cannot see indexes), and RLS by `verify_schema` ("expected RLS on 8 tables, found 7"). The gated test does not check RLS, and the drift test only reads the real migration text.
- Gate: lint, format:check, typecheck clean; 874 tests passed, 117 skipped (gated); `npm run build` passed in a throwaway copy.

## Found

- `ON DELETE RESTRICT` reports 23001 (`restrict_violation`), not 23503. My first gated test expected 23503; the migration was right, the test was wrong.

## Not seen

GitHub Actions for this change (including `db-verify` with the new probes), and staging. Nothing reads or writes the table yet; TASK-053 and TASK-054 do.

## Decisions left open

- No uniqueness on (recipient, request, kind). Add it only if TASK-053 needs idempotent writes.
- The CSV row for TASK-052 and the handoff are not updated (only when asked).
