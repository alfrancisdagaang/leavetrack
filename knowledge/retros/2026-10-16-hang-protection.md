# Retro — hang protection (unplanned, 2026-10-16)

Scope: after the resilience fix (`6cda7f3`) staging still stuck, and Vercel logged `Task timed out after 300 seconds`. A request that
runs 300 s is a call that never answers, not a slow query. **The root cause is still unproven**; the candidates are a stale or
queued database connection, a stale Auth connection, or pooler queueing. This slice bounds every external call and names the
stage that hangs.

## What changed

| Change                                                                                                                                                                      | Why                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/lib/supabase/fetch.ts`: `fetchWithDeadline` (5 s per fetch, trips after the first timeout) and `withDeadline` (5 s for a whole Auth call, including client retries)    | supabase-js has no timeout; its token refresh retries with backoff.                                        |
| Server client (`auth.get_user`) and proxy (`proxy.get_claims`) use both                                                                                                     | Every page does the Auth check first.                                                                      |
| `timedQuery` races the query against 8 s; a hung query fails with `SERVICE_UNAVAILABLE`; the late result is swallowed; expected `AppError`s are not logged as DB faults     | A hung query no longer holds the request.                                                                  |
| All read queries on the other pages and read API routes use `timedQuery` with a name                                                                                        | Same deadline, named in the log. Writes are deliberately not wrapped (see below).                          |
| `maxDuration`: 30 s for the app layout, login, API routes; 60 s for the cron route                                                                                          | A hang can no longer run 300 s.                                                                            |
| Proxy: when the Auth check could not complete, pages pass through (the page re-checks in `getSession()`), `/api/*` gets a 503 envelope; a real "no session" still redirects | An outage must not look like a logout. It grants nothing: every page calls `requireSession`/`requireRole`. |

## Verification

- `lint`, `format:check`, `typecheck`, `npm test`: 330 passed, 14 skipped (gated real-DB tests).
- **Local hang smoke** (a TCP server that accepts and never answers, standing in for Supabase Auth; expired session cookie):
  first attempt with only a per-fetch deadline, `/api` took 33 s and the dashboard did not finish in 60 s because the client retries
  the refresh. After adding the whole-call deadline: `/api/leave-requests` 503 in 5.0 s, `/dashboard` error page in 10.3 s,
  `/login` form in 10.1 s, mock sign-in unaffected (0.4 s); the log shows `Deadline exceeded` with `stage: proxy.get_claims`.
- **Not run:** `npm run build` (port 3000 held by the user's own server). **Not proven:** that this is the staging cause; a local
  black hole is a reproduction of a hang, not of the real stall.

## Issues

| Severity | Issue                                                                                                                                                                              | Fix                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| FIX NOW  | A per-fetch deadline alone left a hung Auth call at 33 s+ (client retries). Found by the smoke, fixed with `withDeadline` and the trip flag.                                       | Done.                                                                                    |
| BACKLOG  | When Auth hangs, the proxy waits 5 s and the page waits another 5 s (10 s total, then the generic error page).                                                                     | Pass the proxy's "unavailable" result to the page via a request header.                  |
| BACKLOG  | Writes (create request, decision, accrual) have no query deadline: abandoning a write could still commit while the user saw an error and retried. They rely on `maxDuration` 30 s. | Add idempotency or a transaction-level timeout before wrapping writes.                   |
| BACKLOG  | A deadline abandons a query but does not cancel it; a stalled connection stays busy until the server or pooler gives up.                                                           | If logs show query deadlines, recycle idle connections (`idle_timeout`, `max_lifetime`). |
| BACKLOG  | `error.tsx` is generic ("Something went wrong"); an outage shows it with status 500.                                                                                               | Dedicated "temporarily unavailable" wording.                                             |

## How to verify on staging

Deploy, then use the app as manager and HR. A hang should now end in at most about 10 s with a log line naming the stage:
`Deadline exceeded` (`stage: auth.get_user` or `proxy.get_claims`) or `Database query hit its deadline` (`query: <name>`).
Send those lines. If none appear and a request still takes 300 s, the hang is outside these calls (rendering or streaming).
