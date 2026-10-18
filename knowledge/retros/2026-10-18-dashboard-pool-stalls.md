# Retro — dashboard database stalls: parallel reads over the pool size, 2026-10-18

Scope: pages hit `Database query hit its deadline` locally and on Vercel after US-11. Fix: fewer parallel statements per page.
Read paths only. No migration, no write path touched, `proxy.ts` untouched, no UI change.

## Symptom and cause

- Symptom (the user): clicking between Dashboard, Request Leave and My Balance is fine for a few clicks, then slow, then
  `{"query":"dashboard.calendar","ms":5000,"deadlineMs":4999,"msg":"Database query hit its deadline"}`. It was fine after the
  page-load reliability fix (`517ce12`) and broke after the Upcoming leave and Recent activity cards (`93f7888`).
- `deadlineMs: 4999` is the retry's budget (8000 minus the 3000 first attempt): both attempts got no answer.
- **Cause (measured, mechanism not fully explained):** a dashboard load needed more parallel statements than the pool holds
  (`max: 5`). Counted from the code and confirmed by a test (below): employee 6, manager and HR 7, My Balance 5 (Request Leave 4). With 6 parallel statements against the real pooler, hung statements piled up on every page load
  (1, 2, 3 ... 6 of 6) and finished about 8.1 s late. With 4 or 5 per page nothing hung (one `57014` in one of 12 loads).
- Why it spreads to other pages: every page of one server instance shares the pool. A hung read keeps its connection, so
  Request Leave, My Balance and Approvals stall too even though they are small.
- Why the retry makes it worse: `timedRead` retries a stalled read, but the abandoned first query keeps its connection, so a page
  needing the whole pool has none left for the retry.
- **Not explained:** why exceeding the pool hangs instead of queueing briefly. The fixed ~8.1 s hold looks like a server or pooler
  timer (a `57014` statement-timeout error showed up once on a plain `select 1` during the 5-per-page probe, and once on a real query
  right after the old-code run left abandoned queries).
  That is a lead, not a finding.

## Decisions (user)

- Fold the manager and HR pending-approvals count into the summary read (one statement), instead of raising the pool size.
- Run the plan's verification and keep the manager dashboard at 4 parallel statements, not 5: a retry needs a spare connection.

## What changed

- `src/lib/leave/service.ts`: `loadSummaryRow` is one statement (three JSON subselects: leave types, this user's balances, this
  user's pending requests, plus an optional pending-approvals count). `loadBalanceSummary`, `getBalanceSummary` and `getMySummary`
  sit on it, so the shared statement count is now 1 per summary and 2 for `getMySummary`. New `getDashboardSummary(sql, userId,
countApprovals)`. Balances are cast to text and dates to text, so the shapes equal the old selects.
- `src/app/(app)/dashboard/sections.tsx`: `SummarySection` makes one `dashboard.summary` read. The whole team queue is no longer
  loaded just to count it. `getTeamQueue` is still used by Approvals and the API.
- `src/lib/db/client.ts`: `POOL_MAX = 5` exported (value unchanged).
- Tests: `service.test.ts`, `sections.test.ts`, new `src/lib/db/query-budget.test.ts`, new gated
  `src/lib/leave/balance-summary.integration.test.ts`. Pattern note in `knowledge/patterns/implement-and-test.md`.

Parallel statements per page, after the session lookup (pool 5; budget 4):

| Page                     | Before | After |
| ------------------------ | ------ | ----- |
| Dashboard, employee      | 6      | 4     |
| Dashboard, manager or HR | 7      | 4     |
| Request Leave            | 4      | 2     |
| My Balance               | 5      | 3     |
| Approvals                | 2      | 2     |

## Acceptance criteria (the approved plan)

| Criterion                                                                                   | Result | Evidence                                                                                                       |
| ------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| Balances are one statement with identical output; user scoping stays in SQL                 | PASS   | statement-count tests; filters in SQL (test); 7 of 7 users equal old output on staging; real-engine tests 5/5  |
| Approvals count folded into the summary read, scoped by `u.manager_id`, at most 4           | PASS   | values test `[id, id, flag, id]`; budget test peak 4; Marco 2 and Priya 1 on a real engine (Leo never counted) |
| `POOL_MAX` exported, value unchanged                                                        | PASS   | `client.ts`: `POOL_MAX = 5`, `max: POOL_MAX`                                                                   |
| Tests: 1 and 2 statements; budget guard for dashboard x3, Request Leave, Balance, Approvals | PASS   | all in `service.test.ts` and `query-budget.test.ts`; the guard fails on the old code (6, 7, 7, 5 against 4)    |
| Retro and pattern note                                                                      | PASS   | this file and the pattern note                                                                                 |
| Gate: lint, format:check, typecheck, test, build                                            | PASS   | 491 passed, 29 skipped; production build ok in a throwaway copy                                                |

## Verification (mine)

- **Real engine (pglite), fresh database per file:** `leave-types` 2/2 (submit and approve go through the merged statement),
  `balance-summary` 5/5, `dashboard-lists` 10/10, `calendar` 8/8. With both scope filters broken (`or true`), 4 of the 5 summary
  tests fail; file restored and `diff`ed.
- **Budget guard run against the old code** (throwaway copy): fails for dashboard employee (6), manager (7), HR (7) and My Balance
  (5); passes for Request Leave, Approvals and the harness check.
- **Equivalence on your real staging data:** the new one-statement result equals the old three selects plus `getTeamQueue` count
  for all 7 seeded users (balances, pending days, approvals count). One earlier attempt hit `57014` right after the old-code run
  left abandoned queries on the pooler; it passed on the retry 20 s later.
- **Live probe, real sections, real pool and `timedRead`, read-only, from the Mac to staging** (same harness on both):

| Scenario                                                                 | Old code                                                                                              | New code                                                                                 |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| S1 manager dashboard x10, 3 s apart                                      | 9 of 10 bad: loads 2 to 5 took about 3.2 s with a retry; loads 6 to 10 took 8 s, every section failed | 0 of 10 bad: about 200 ms (755 ms first)                                                 |
| S2 employee dashboard x10                                                | 10 of 10 bad: 8 s, every section failed                                                               | 0 of 10 bad: about 200 to 250 ms                                                         |
| S3 mixed navigation (Dashboard, Request Leave, My Balance, Approvals) x6 | 24 of 24 bad: 8 s each; Approvals threw 503                                                           | 0 of 24 bad: 185 to 257 ms                                                               |
| S4 one connection held busy (pg_sleep 6 s)                               | 8 s, every section failed                                                                             | 762 ms                                                                                   |
| S4 two connections held busy                                             | not reached: the old pool was so wedged the test hit its 120 s limit                                  | 3.2 s: one read waited out its 3 s first attempt, the retry succeeded, 1 deadline logged |

## Behaviour change to know

- **The two dashboard summary cards now fail together.** Balances and the pending count share one read, so one failure marks all the
  cards unavailable (before: they failed independently). Both come from the same database, so a partial failure was unlikely; the
  tests changed to match.

## Backlog

- With two stuck connections the new dashboard takes 3.2 s (one read waits the 3 s first attempt). Lowering `READ_FIRST_ATTEMPT_MS`
  would shorten it; not done, no evidence it is needed.
- **Vercel is unverified.** Everything above ran from the Mac against staging. Vercel runs several instances, each with its own
  pool of 5. After deploying, watch the logs for `Database query hit its deadline`, `Retrying read query` and `57014`.
- The mechanism behind "over the pool hangs" and the `57014` on plain selects is open (see above).
- Audit History is not in the budget test (one read, then two in sequence; it never exceeds 2).
- The probe harness (page-load, equivalence and pglite server) lives in the session scratchpad, not the repo. The method is in the
  pattern note.
- The summary read is `timedRead`, which is safe to retry (read only).
- Gated real-database tests still need a fresh database each and are not wired into CI (already open).
