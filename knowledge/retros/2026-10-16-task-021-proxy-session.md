# Retro — TASK-021 proxy.ts verifies the Supabase session (2026-10-16)

Scope: US-09 / EPIC-2. `src/proxy.ts` accepts a Supabase session (validated with `getClaims()`, cookies refreshed onto every
response) or, only while `ALLOW_MOCK_LOGIN` is true, the `mock-role` cookie. `/api/health` is public, `/api/jobs/*` stays behind
the CRON_SECRET bearer check. The proxy checks identity only; the role and the `users` row come from `getSession()`.
Also in this task: `/login` is public for everyone and the page itself sends people with a real session on (this closes the
redirect loop recorded in the TASK-020 retro), and `parseRole`/`SESSION_COOKIE` moved to `src/lib/auth/mock-cookie.ts` (re-exported
from `session.ts`) so the proxy no longer bundles the db client, logger or Supabase through `session.ts`.

## Acceptance criteria

| AC                                                               | Proof                                                                                                                                                                | Result                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| AC1 no valid session: pages redirect to /login, API gets 401     | `proxy.test.ts` (no cookie, invalid `sb-` cookie, a throwing check = fail closed, `next` keeps the query, 401 envelope); dev-server smoke in all three flag settings | PASS                                               |
| AC2 a valid session reaches the page                             | `proxy.test.ts` with a stubbed Supabase client (claims present; refreshed cookies carried on pass, redirect and 401). **Not proved against real Supabase.**          | PARTIAL (mock-proved; real round trip is TASK-022) |
| AC3 the mock-role cookie is ignored when ALLOW_MOCK_LOGIN is off | `proxy.test.ts` (page, API, cookie cleared); smoke: flag off redirects `/dashboard` to `/login` and `/login` then renders (no loop)                                  | PASS                                               |
| AC4 /api/jobs/* unaffected, still needs the cron bearer secret   | the three existing cron tests, unchanged; smoke: 401 without a bearer                                                                                                | PASS                                               |

## Verification

- `lint`, `format:check`, `typecheck`, `npm test` pass (284 passed, 14 skipped = gated real-database tests). `npm run build` passes
  (port 3000 checked in the same command) and no longer logs `DYNAMIC_SERVER_USAGE`.
- Dev-server smoke on port 3001 (stopped afterwards), three settings (mock on; mock off; mock off with an unreachable Supabase URL):
  anonymous page and API, `/login`, `/api/health`, cron without bearer, mock cookie, `/login?next=/approvals` with a session
  (redirects to `/approvals`), a bogus `sb-` cookie (clean redirect, no hang).
- **Not verified:** real Supabase (does it accept our cookies, which signing keys the project uses, token refresh). Agreed to prove
  it with the login form in TASK-022.

## Issues

| Severity | Issue                                                                                                                                                              | Fix                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| FIX NOW  | The TASK-020 `catch` in `getSession()` swallowed Next's `DYNAMIC_SERVER_USAGE` (seen as a logged error during `npm run build`).                                    | `unstable_rethrow`; regression test; pattern added to coding-standards. |
| BACKLOG  | The login page still shows the Day 0 mock form and its "Demo sign-in" warning even when the flag is off (the action would still set a cookie that grants nothing). | TASK-022 (form, action refusal).                                        |
| BACKLOG  | `getClaims()` is verified locally only with asymmetric project signing keys; with legacy HS256 it falls back to a network `getUser()` per request.                 | Check the project's signing keys in the dashboard before the demo.      |
| BACKLOG  | A signed-in account with no `users` row passes the proxy and is sent to `/login` by `requireSession()`; the login page leaves it there (no loop).                  | TASK-022 signs such accounts out and shows "not set up".                |
| BACKLOG  | Parallel requests with the same expired session can still race on the single-use refresh token (Supabase README); the proxy narrows it.                            | Watch for it in staging.                                                |

## Deliberate choices

- `getClaims()` rather than `getUser()` in the proxy; Supabase wins over a mock cookie; a stale mock cookie is cleared when the flag is off.
- The proxy never touches the database: the `users` row check stays in `getSession()` (one lookup per request).
