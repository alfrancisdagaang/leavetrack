# Retro: EPIC-10, role scope tone-down (TASK-058 to 061)

Code and seed shipped in `87edcea` (TASK-058 and 059) and `58c0ce7` (TASK-060). This retro is TASK-061, the validation of the epic as a whole. No `src/` change was needed. Not pushed. The supervisor's OK for removing demoed behaviour was taken as obtained on the user's word ("yes", 2026-10-19); I have not seen it.

## The role model now

| Role     | Can                                                                                                                       | Cannot                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Employee | Request leave, see own balance and requests, dashboard and calendar                                                       | Approve, override, see a team or the audit history                 |
| Manager  | Approve or reject direct reports' requests, Team Approvals (queue and My team), team calendar                             | Request leave, see a balance, override, see the audit history      |
| HR Admin | Override over-balance requests (or reject them), Audit History, dashboard with the company calendar and an override count | Request leave, see a balance, approve normal requests, have a team |

No role was added or renamed. Every gate is in two places: the page or route (`requireRole`, `assertRole`, plus `canRequestLeave` and `canApproveLeave`) and, for the two writes, the SQL path (`createLeaveRequest` and `decideLeaveRequest` read the role from the `users` row).

## What was removed (the supervisor's golden rule: this is behaviour that existed and was demoed)

- Managers and HR Admins can no longer request leave, open Request Leave or My Balance, or see balance cards. `POST /api/leave-requests` and `GET ?scope=mine` refuse them.
- HR Admins can no longer approve or reject a request, open Team Approvals or My team, or see the "Pending approvals" card (it is now "Awaiting HR override"). `POST .../decision` and `GET ?scope=team` refuse them.
- The nav no longer lists Request Leave or My Balance for managers and HR, or Team Approvals for HR.
- The seed no longer gives managers or HR admins leave policies, balances or requests. The three demo requests from Marco, Priya and Hana (ids `...03`, `...06`, `...07`) are retired.

## Known limitation (say it when asked)

A manager or HR Admin who needs leave has no way to request it in LeaveTrack. Who approves leave for managers and HR is a question for the supervisor; the docs do not say.

## Validation (TASK-061)

One run on one build: a throwaway copy of `main` at `58c0ce7`, `npm run build`, `next start` on a seeded PostgreSQL 18 (migrations, the seed twice, `verify_schema.sql` and `verify_seed.sql` passed first), headless Chrome with mock sessions (Elena, Marco, Hana), each session in its own browser context. **248 checks, 0 failed.**

- **Pages (AC1), 72 visits:** each of 3 roles x 8 pages x 3 widths (1440, 375, 320) went where expected (open, or redirect to `/dashboard`). Every open page loaded with no failure note and no horizontal scroll.
- **Links (AC1):** the nav of each role is exactly its set (employee: Dashboard, Request Leave, My Balance; manager: Dashboard, Team Approvals; HR: Dashboard, HR Overrides, Audit History). Every internal link on every page a role can open (5, 7 and 5 distinct links) leads to a page that role can open. No dead link to a forbidden page.
- **No session:** every page sends a visitor without a session to `/login`.
- **API (AC2):** no session, Elena, Marco and Hana against six calls (`POST` and `GET mine` and `GET team` on `/api/leave-requests`, `decision`, `override`, `audit`). All 18 refusals returned the expected 401 `UNAUTHORIZED` or 403 `FORBIDDEN` in exactly `{success:false,error:{code,message}}`, and they changed no data (row counts of requests and audit rows, the sum of balances and the pending count were compared before and after; row contents were not). The allowed calls then worked: Elena's POST 201 and `mine` 200, Marco's `team` 200 and decision 200 (Jun's request approved), HR's override 200 (audit row records the 3-day shortfall) and audit read 200.
- **Another team (AGENTS.md scoping rule, Leo):** Marco deciding Leo's request is 403 "not from one of your direct reports" and Leo's request stays pending. Marco opening Leo's member page shows exactly the page for a person who does not exist ("We couldn't find that person on your team"), with no Leo data in the page or the raw HTML.
- **Gated suites (all 16 files) on fresh seedless databases:** 15 together or alone (98 + 10 tests) and `users.integration.test.ts` (4): all passed. `dashboard-lists` ran alone, as the handoff requires.
- **Gate (AC3):** lint, format:check, typecheck clean; 872 tests passed, 112 skipped (gated); `npm run build` passed on the throwaway copy.

## Acceptance criteria

AC1 (each role sees exactly its pages and no others, by link and by direct address): PASS. AC2 (API attempts outside the role are refused with the standard envelope): PASS. AC3 (the quality gate passes): PASS. AC4 (this retro lists what was removed and the known limitation): PASS.

## Not seen (do not read this retro as proof of these)

- **GitHub Actions**, including the new "Seed twice" row-count comparison and "Verify seed data" steps, which have only run locally. **Vercel** and **real Supabase**.
- **The real sign-in path.** Every browser check used the mock `mock-role` cookie, which maps to fixed users (Elena, Marco, Hana), so Priya, Leo and Sam were never signed in. A real session takes its role from the `users` row and feeds the same `session.role` the gates read, but that path was not exercised here. The staging demo is the user's to run against the checklist.
- Nothing on staging was touched.

## Found

- **Harness bug (mine, fixed):** pages opened in one Chrome share one cookie jar, so a later `setCookie` changed the role of every open page; my first API run therefore ran as Hana for all three "roles" and the "no session" visits were still signed in (30 false failures, none a product bug). Fixed with one browser context per page. Lesson: for a role matrix, use a separate browser context per role.
- **Not-found status is 200 (observation, harmless):** Marco's visit to Leo's member page, and to a missing id, returns HTTP 200 with the not-found screen, because the response streams and the status is already sent. The content is identical for both and the page is `noindex`, so nothing leaks; only a script that checks the status code would be misled.

## Open items and decisions for the user (nothing done)

- **Orphaned pending requests on staging** (Marco, Priya, Hana, and any from Sam): nobody can decide them now; they stay Pending in the audit list. Leave as history (default) or a soft-delete data migration. The staging-rollout runbook has the SQL to list them.
- **Accrual** still credits the old policies of managers and HR admins on staging each month (no page shows them). An employee-only join in `accrual.ts` would stop it; not in the CSV.
- **Re-run `supabase/seed.sql` on staging** before the demo to add Elena's over-balance Sick request (the demo checklist assumes it). The shortfall reads 3 days on a fresh seed and about 2 on staging after one accrual run.
- Update `knowledge/HANDOFF.md` (it still says EPIC-10 has not started and that roles stack) and mark TASK-058 to 061 and the EPIC-10 header `Done` in the CSV, only when asked.
- Questions for the supervisor: who approves leave for managers and HR; whether the removal of the manager and HR request ability is accepted.
