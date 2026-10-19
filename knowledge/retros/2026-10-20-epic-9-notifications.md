# Retro: EPIC-9, in-app notifications (TASK-052 to 055, 057)

TASK-052 to 055 are on `origin/main` (`6588ba3`, `59c8503`, `52055f4`, `bf50ff9`, docs `1932bdb`). TASK-057 (this retro and the end-to-end test) is not committed yet. TASK-056 (optional email copies) was deliberately not built. Closes the biggest gap against the PRD: US-01 AC1 (the manager is notified) and US-03 (the employee is notified).

## What shipped

| Task | What                                                                                                                                              | Retro                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 052  | `notifications` table: RLS, per-recipient and partial unread indexes, never deleted or truncated, `read_at` settable once; `kind` is text + CHECK | `2026-10-20-task-052-notifications-table.md` |
| 053  | `notifyLeaveEvent`: one statement in each event's own transaction; recipients come from the database                                              | `2026-10-20-task-053-write-notifications.md` |
| 054  | `GET /api/notifications`, `POST /api/notifications/read`: one statement each, scoped to the session user                                          | `2026-10-20-task-054-notification-routes.md` |
| 055  | The bell in the top bar, read in the browser so the layout adds no statement                                                                      | `2026-10-20-task-055-notification-bell.md`   |
| 057  | One end-to-end test through the real routes, the browser check on `HEAD`, this retro                                                              | this file                                    |

## Who is told, per event

| Event                                | Notified                                                        | Never notified                   |
| ------------------------------------ | --------------------------------------------------------------- | -------------------------------- |
| Employee submits                     | the employee's manager, only if that person's role is `manager` | the employee, HR, any other team |
| Manager approves or rejects          | the employee                                                    | the manager, HR, any other team  |
| HR overrides (approves over balance) | the employee and their manager                                  | HR (the actor), any other team   |
| HR rejects an over-balance request   | the employee                                                    | the manager, HR                  |

The person who acted is never a recipient (a SQL rule). An HR Admin who happens to be somebody's `manager_id` is never told of a submit: they cannot approve since EPIC-10.

## Decisions taken (defaults, no objection)

1. `kind` is text + CHECK, not an enum (an enum value can never be removed); `NOTIFICATION_KINDS` and the CHECK list are kept in step by a test.
2. No uniqueness on (recipient, request, kind): every path runs once under a row lock and a `status = 'pending'` guard.
3. HR rejecting an over-balance request tells the employee only.
4. The bell reads its count in the browser (after load, on open, on tab focus), never in the layout and never on navigation, because the three dashboards already use all 4 allowed statements. This differs from the CSV text for TASK-055, which is not edited.
5. A notification shows the employee's name, the leave type and the dates only; never the reason or a decision note. If an employee later changes manager, the old manager's earlier notification still shows that name and those dates.

## Validation (TASK-057)

- **AC1 and AC2, one flow through the real route handlers, services and SQL on PostgreSQL 18.4** (`src/app/api/notifications/notifications-e2e.integration.test.ts`, 9 tests; only the session and the database handle are replaced): Elena submits, only Marco is told; Leo (another team) submits, only his manager is told and Marco's list is unchanged; Marco approves and rejects, only Elena is told; an over-balance approval by the manager is a 409 with no notification; HR overrides, the employee and Marco are told and HR is not; **a database query shows exactly the expected 6 (recipient, kind) groups and nothing extra**; Leo and the other manager see none of it, Leo marking a foreign id or marking all changes nothing, and nobody's count moves; the owner marks one then all; no reason or note appears in any notification response; no session gives 401 in the envelope.
- **8 mutations, each fails that test** (list without the recipient filter, mark UPDATE without it, mark-one marks everything, notification skipped in submit, decide and the override approval, override without the manager, submit tells the employee with the actor guard removed). The sources were restored and compared with `HEAD` afterwards.
- **AC4, the browser check on the exported `HEAD`** (`git archive` of `1932bdb`, not the working copy; production build; seeded PostgreSQL; headless Chrome; one context per role): employee, manager and HR at 1440, 375 and 320 px, **199 checks, 0 failed** (count and badge, 44 px targets, no sideways scroll, keyboard, Escape and focus, the failing-read state with Retry, row click and mark-all, the stale-read race).
- **AC3, gate on `HEAD` plus the new test:** lint, format:check and typecheck clean; 963 tests passed, 147 skipped (gated); the query-budget guard is green and still fails if the layout or the bell reads from the database. Gated files: 18 together pass (134 tests); `override-count` alone 3 of 3; `dashboard-lists` alone 10 of 10. `npm run build` passed on the exported `HEAD`.

## Not seen

- **Real Supabase sign-in.** Every browser and HTTP check used the mock `mock-role` cookie (Elena, Marco and Hana only); Leo and the short-balance employee were exercised through the route handlers with their own ids, never in a browser.
- **GitHub Actions, Vercel and staging** for these commits. After the push the user reported that it was working ("its okay now"); I did not see the run, and was not told which job logs were checked.
- **A screen reader.** Names, roles and live regions are in the markup and were checked; spoken output was not.

## Open

- TASK-056 (email copies) is undone and optional. The Gmail demo sender decision from the handoff still stands for EPIC-8.
- The CSV rows for TASK-052 to 055 and 057, the EPIC-9 header and the TASK-055 text, and `knowledge/HANDOFF.md`, are not updated (only when asked).
- **Gated tests do not run in CI** (no `TEST_DATABASE_URL`), so this proof is a local run. Turning them on needs `override-count` to stop racing with files that insert over-balance requests (it failed 2 of 2 combined runs without any EPIC-9 file).
- A date range can break after the dash at 375 px in the bell ("Feb 1–" then "26"); cosmetic.

## How to re-run the browser check

The scripts live in the session scratchpad and are gone afterwards. Recreate from `knowledge/patterns/implement-and-test.md` (the real-PostgreSQL and shared-chrome sections): `puppeteer-core` against `/Applications/Google Chrome.app` in a scratchpad directory, `next start` of a throwaway export of `HEAD` (`git archive`, copy `node_modules`), `ALLOW_MOCK_LOGIN=true`, a seeded embedded PostgreSQL, data created through the real API (Elena submits, Marco decides, HR overrides), one browser context per role, and a deterministic stale-read test that fetches the answer from Node before the click and delivers it late.
