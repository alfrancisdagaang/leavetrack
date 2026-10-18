# Retro — TASK-027 staging rollout and verification (2026-10-18)

Scope: EPIC-2 task. Runbook and demo checklist for putting staging into its demo state, plus a few demo requests in the seed.
No app code changed. The live steps (Supabase and Vercel switches, click-through) are the user's.

## Decisions (2026-10-18, the user)

- **`ALLOW_MOCK_LOGIN` is OFF on the demo URL.** Rollback (set it true, redeploy, say so plainly) is in the runbook.
- **Demo requests are pending only**, because an approved row would need a balance deduction that `on conflict do nothing` cannot apply idempotently.

## What changed

- `supabase/seed.sql`: four more pending requests with fixed UUIDs and `submitted` audit rows (Elena 21-23 Oct, Jun 26 Oct, Priya
  28-29 Oct, Hana 5-6 Nov). Users, balances and the original three requests are untouched.
- `knowledge/runbooks/staging-rollout.md`: ordered steps (Supabase sign-ups off and Site URL, run the seed, Vercel variables and
  redeploy, key rotation), rollback, and what to look at if a page hangs.
- `knowledge/runbooks/demo-checklist.md`: one checklist per acceptance criterion, the TASK-025 live checks, and a five-minute demo script.

## Acceptance criteria

| AC  | Criterion                                                            | Result  | Evidence                                                                                                              |
| --- | -------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| AC1 | each seeded role signs in on the live URL and sees only its own data | PARTIAL | Scoping proved in SQL below; the live sign-in and click-through are the user's (checklist ready)                      |
| AC2 | Marco's queue never shows Leo's request                              | PARTIAL | Queue SQL from `getTeamQueue` returns Elena and Jun only; Leo's request is in Priya's queue. Live check is the user's |
| AC3 | an email with no `users` row cannot get a session                    | PARTIAL | Unit test exists (`actions.test.ts`, "AC3"); the real-Supabase run (`nobody@example.test`) is the user's              |
| AC4 | the `ALLOW_MOCK_LOGIN` value on staging is recorded                  | PARTIAL | Decision recorded here (off); the handoff gets the confirmed live value once the user reports it                      |

## Verification (2026-10-18, mine)

- `lint`, `format:check`, `typecheck` clean; `npm test` 369 passed, 14 skipped (same as before; no code changed).
- **Real Postgres engine, in memory** (pglite, installed in the session scratchpad, not in the repo; there is no local Postgres on this
  Mac): all four migrations, then `seed.sql` twice. Counts after the first and second run are identical (users 7, requests 7, audit 7,
  balances 14), so the seed is idempotent. Every request has a `submitted` audit row. All new dates start and end on weekdays.
- **Queues** (the same `where u.manager_id = ...` shape as `getTeamQueue`): Marco gets Elena and Jun (two); Hana gets Marco and Priya;
  Sam gets Hana; Priya gets Leo. Nothing from another team appears in Marco's.
- `parseSeedEmails` still reads exactly the seven emails from the edited seed (the auth seed script depends on it).

## Not verified

- Anything on the live URL: sign-in per role, the Cookies table flags and Console CSP result (TASK-025), the "not set up" account, the
  mock card being gone. The user reports each item; the handoff records it.
- pglite is not Postgres 17 on Supabase: it needed the `create extension pgcrypto` line removed (`gen_random_uuid()` is built in from
  Postgres 13). The migrations themselves were not edited. CI's real Postgres still runs the seed twice on every push.
- The `auth:seed` dry run: it requires the service-role key and demo password in the shell, which I do not hold, so I called the parser directly.

## Backlog

- Wire `TEST_DATABASE_URL` into CI (`db-verify`) so the gated real-database tests run there (already open in the handoff).
- The checklist lists Sam's queue nowhere; if the supervisor logs in as Sam, one pending request (Hana's) is expected.
