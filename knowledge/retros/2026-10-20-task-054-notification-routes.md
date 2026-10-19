# Retro: TASK-054, notification read and mark-read routes (EPIC-9)

Not committed, not pushed. Builds on TASK-052 and TASK-053 (both also uncommitted).

## What shipped

- `GET /api/notifications` (`src/app/api/notifications/route.ts`): the session user's latest 20 notifications (read or not), newest first, plus the unread count, in **one statement** (`listNotifications`, a scalar subselect and a `json_agg`). Any role: the scope is the recipient (`recipient_id = session user` in the SQL), not the role. `cache-control: no-store`. Read through `timedRead`.
- `POST /api/notifications/read` (`.../read/route.ts`): marks the session user's unread notifications read, all or one `id`, in **one statement** (`markNotificationsRead`, a CTE `update ... returning` and the remaining unread count). A write, so a route handler (rule 11), not retried. An empty body means "mark all"; bad JSON or a bad id is `VALIDATION_ERROR`; a client-sent `user_id` is stripped.
- `markReadSchema` in `schemas.ts`.
- The response carries structured fields (kind, employee name, leave type, dates, `requestRemoved`, read time) and never the reason or a decision note. The sentence is built by the bell in TASK-055.
- A foreign id, an unknown id and an already-read id all answer `{ marked: 0, unread: n }`, so the response never says whether an id exists.

## Decisions taken (defaults from the plan; you did not object)

1. All three roles can call both routes.
2. The list returns the latest 20 whether read or unread.
3. Mark-read returns `{ marked, unread }`.
4. A removed request still lists, flagged `requestRemoved` (the join does not filter `is_deleted`).
5. If an employee later changes manager, the old manager's earlier notification still shows that employee's name and dates (they were entitled at the time). Left as is.

## Validation (real PostgreSQL 18.4, embedded)

- Gated `notifications.integration.test.ts`: 9 of 9. It covers scope (A never sees B's rows), newest first, cap of 20 out of 25, the unread count, a removed request, no reason or note in the output, mark-all and mark-one touching only the caller's rows, foreign/unknown/already-read ids as identical no-ops that change nothing, three simultaneous mark-alls (no error, every row marked exactly once), and the unread count agreeing with the next list.
- **Mutation proofs, 10 single mutations**: no recipient filter in the list, in the count, in the update; no `read_at is null` in the update; mark-one marks all; order flipped; limit 21; reason selected; removed requests hidden; stale unread count. **Every one was caught by at least one suite.** The gated test alone caught mark-one-marks-all and the stale unread count; the unit tests alone caught "selects the reason" (the mapping hides the column from the JSON, so only the statement text shows it).
- Gate: lint, format:check, typecheck clean; 914 tests passed, 138 skipped (gated); `npm run build` passed in a throwaway copy and lists both new routes.
- Gated files: 17 together (minus `override-count` and `dashboard-lists`) pass, 125 tests; `override-count` alone 3 of 3; `dashboard-lists` alone 10 of 10.

## Found

- The first draft of one mutation matched two places (an ambiguous pattern), so it did not run until I made it specific. The harness asserts the pattern matches exactly once, which caught it.
- The CTE's outer select cannot see its own `update`, so the unread count excludes the marked ids by hand; removing that exclusion is caught by the gated test.

## Checked over HTTP (validate step)

A production build of this code (`next start`, throwaway copy) on a seeded PostgreSQL 18.4, mock-role cookies: no session is 401 on both routes in the standard envelope; Elena's submit made Marco's list show one unread `submitted` notification (Elena's own and HR's lists stayed empty); the response carried no reason; `cache-control: no-store` is set; Elena marking Marco's notification id answered `marked: 0` and left Marco's unread at 1; Marco marking it (with a client `user_id` in the body) marked exactly 1; an empty POST then marked 0; a bad id and bad JSON are `VALIDATION_ERROR`. `createdAt` comes back in the database session's offset (`+08:00` on the embedded server, `+00:00` on Supabase): the bell should parse it with `new Date()` and format in `APP_TIMEZONE`.

## Not seen

GitHub Actions for TASK-052 to 054, Vercel, staging, real sign-in (only the mock cookie was used), and a browser: nothing renders these routes yet (TASK-055 builds the bell).

## Open

- The CSV rows for TASK-052 to 054 and the handoff are not updated (only when asked).
- `override-count.integration` still races with other gated files in a combined run (logged in the TASK-053 retro).
