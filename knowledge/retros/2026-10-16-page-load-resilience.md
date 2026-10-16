# Retro — page-load resilience fix (unplanned, 2026-10-16)

Scope: staging dashboards sometimes hung or stayed on the loading skeleton, mostly for manager and HR. **The root cause is
unproven.** This slice makes a database or Auth outage visible and non-destructive, and adds the logs that will name the
slow query next time.

## Evidence that prompted it

- Browser console: React error #412 = "Connection closed" (the streamed response was cut off while Vercel logged 200).
- Vercel log: `Session resolution failed; treating as signed out`, then `Unhandled Rejection: canceling statement due to
statement timeout` (Postgres `57014`, raised by the server, so the connection was alive and the query ran long).
- Supabase (free nano): CPU and disk IO low; network out spikes only a few KB; tables tiny. Region matches Vercel (Mumbai).
- Manager and HR are worse than employee (more queries per page), and failures show on in-app navigation but not on a full refresh.

## What changed

| Change                                                                                                                                                                   | Why                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `getSession()` throws `SERVICE_UNAVAILABLE` (503) when the database or the Auth server cannot be reached; a missing or invalid session is still `null`; fail-closed kept | A blip no longer looks like a sign-out and bounces to `/login`.    |
| `/login` shows the form when the session cannot be checked                                                                                                               | The login page must stay reachable during an outage.               |
| `timedQuery(name, fn)` in `src/lib/db/timed.ts`, used for `session.find_user` and the three dashboard queries                                                            | Logs name, duration and Postgres code (never SQL or values).       |
| Sidebar links use `prefetch={false}`                                                                                                                                     | Fewer background server requests per page view. Effect unmeasured. |

## Dropped on evidence: smaller connection pool

The plan set the pool to `max: 1`. Measured against an unreachable database on `next dev` (employee dashboard, first request):
original `max: 5` 0.5 s, `max: 3` 7 s, `max: 1` 40 s (a second request 80 s). One connection serialises the dashboard's parallel
queries, so a stalled database costs several times as long. With the original pool and all other changes the timings equal the
original code, so the other changes are neutral. `src/lib/db/client.ts` is unchanged.

## Verification

- `lint`, `format:check`, `typecheck`, `npm test` pass (316 passed, 14 skipped = gated real-DB tests).
- Dev smoke with an unreachable database: dashboard still returns 200 for employee/manager and `Database query failed` lines
  appear with the query name.
- **Not run:** `npm run build` (port 3000 was held by the user's own server; a build would overwrite its `.next`).
- **Not tested:** the 503 path against a real Supabase outage; the `prefetch={false}` prop (server render does not emit it).

## Issues

| Severity | Issue                                                                                                                                                                              | Fix                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| BACKLOG  | Audit found no un-awaited query, so the source of the "Unhandled Rejection" is unknown.                                                                                            | Read the new `Database query failed` lines after the next stall.      |
| BACKLOG  | With a refused connection, dev pages take 12 to 19 s on the second and later requests (original code too): postgres.js retries with backoff. A hung database may behave similarly. | Consider a shorter connect/retry policy once the live cause is known. |
| BACKLOG  | Other pages (`approvals`, `audit`, `balance`, `requests/new`) have no per-card fallback; a failed query shows `error.tsx`.                                                         | Add if staging shows failures there.                                  |
| BACKLOG  | `error.tsx` has no dedicated "temporarily unavailable" wording; it says "Something went wrong" with Try again.                                                                     | Polish.                                                               |

## How to verify on staging

Deploy, click through the dashboard as manager and HR for a few minutes. Any stall should now log a named line, e.g.
`Slow database query` or `Database query failed` with `query: dashboard.calendar` and `code: 57014`. Send those lines back.
