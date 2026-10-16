# Retro — TASK-022 login form and actions: email and password (2026-10-16)

Scope: US-09 / EPIC-2. The login page is now an email and password form that signs in through Supabase (`loginAction`), with
one generic error for bad credentials, a "not set up" path that signs the account out again, and sign out through Supabase
(`logoutAction`, signature unchanged). The role-picker mock form is a separate, labelled card (`mockLoginAction`) shown and
accepted only while `ALLOW_MOCK_LOGIN` is true. Not in this slice: the seeding script (024), CSP review (025), change-password
(026), rollout (027).

## Acceptance criteria

| AC                                                                     | Proof                                                                                                                                                                                                                                                                                                                                                   | Result                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| AC1 valid email and password signs in and lands on /dashboard          | `actions.test.ts` with a stubbed Auth client (redirect target, safe `next`, external `next` refused, leftover mock cookie removed). **Live check, 2026-10-16:** the user signed in as Elena on `next dev` (port 3001) with a hand-made Auth user; the server log shows `Signed in` with Elena's seed id and role `employee`, then `GET /dashboard 200`. | PASS (live)                                                                                |
| AC2 wrong password or unknown email: one generic error, no session     | `actions.test.ts`: `invalid_credentials` and `user_not_found` give the identical message; no redirect, no cookie, no users lookup; an Auth outage is reported as "unavailable" instead                                                                                                                                                                  | PASS (stubbed Auth; message path real)                                                     |
| AC3 valid account with no users row: not-set-up message, no session    | `actions.test.ts`: the message, `signOut()` called once, no redirect                                                                                                                                                                                                                                                                                    | PASS (stubbed Auth)                                                                        |
| AC4 sign out ends the session and protected pages redirect to /login   | `actions.test.ts`: signOut, mock cookie cleared, redirect to /login, and still so when signOut throws; the proxy/guards redirect is TASK-021's. **Live check:** the user signed out and signed in again; the log shows `logoutAction` then `GET /login 200` and a later successful `loginAction`.                                                       | PASS (live); the protected-page redirect after sign-out is the proxy's, tested in TASK-021 |
| AC5 mock form not rendered and its action refuses when the flag is off | `login-view.test.tsx` (no mock card, no role select); `actions.test.ts` (no cookie, error); dev-server smoke: flag off renders 0 mock cards and 0 role selects, flag on renders 1 and 1                                                                                                                                                                 | PASS                                                                                       |

## Verification

- `lint`, `format:check`, `typecheck`, `npm test` pass (299 passed, 14 skipped = gated real-database tests). `npm run build`
  passes (port 3000 checked free in the same command; no `DYNAMIC_SERVER_USAGE` log).
- Dev-server smoke on port 3001 (stopped afterwards), flag on and off: the page renders the real form, and the mock card only
  with the flag on. The sign-in form's server action was replayed with its real hidden fields and no Supabase configured:
  HTTP 200 with "Sign-in is unavailable right now. Try again shortly." and no cookie (no crash, no session).
- **Live check (2026-10-16, user-driven, one hand-made Auth user `elena.cruz@leavetrack.example`):** wrong password gave "Incorrect email or password."
  (Supabase code mapped as bad credentials); the right password signed in as Elena (`userId ...0003`, `employee`), the dashboard
  rendered, a reload and month navigation stayed signed in, sign out returned to `/login`, and signing in again worked. The first
  proxy call took ~206 ms and later ones 7 to 11 ms, which suggests `getClaims()` verifies locally (asymmetric signing keys); a
  legacy HS256 key would make every request a ~200 ms network call. Evidence, not proof.
- **Still not verified:** the not-set-up account against real Supabase (needs a second Auth user with a non-seed email and the
  right password), `email_not_confirmed` / rate-limit codes, a live cookie refresh after the access token expires (about an
  hour), and the sign-ups-disabled setting (`disable_signup` was still `false` at 10:5x; the user was asked to switch it off).

## Issues

| Severity | Issue                                                                                                                                                                      | Fix                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| FIX NOW  | My first smoke post returned 500 ("Failed to parse body as FormData"): the replay script omitted React's hidden `$ACTION_*` fields. A test-script mistake, not an app bug. | Script now copies every hidden input from the rendered form; result above. |
| BACKLOG  | The real-Supabase checks above. Do them first thing when the env values and Auth users exist; AC1 and AC4 stay PARTIAL until then.                                         | Live check before TASK-027.                                                |
| BACKLOG  | If Supabase rate-limits sign-in, the person sees "unavailable"; a clearer "too many attempts" message needs the real error code.                                           | Check the live error and map it.                                           |
| BACKLOG  | The login page does not remember the email after a failed attempt (the form resets on error in React 19).                                                                  | Polish.                                                                    |
| BACKLOG  | AGENTS.md still opens with the "MOCK AUTH — never ship past scaffold" banner and says login accepts any input.                                                             | Reword after the live check, with the user's OK.                           |
| BACKLOG  | No browser test of the form itself (submit, focus, error announcement); structure is checked with `renderToStaticMarkup`.                                                  | Add with TASK-025 or a Playwright check if the UI grows.                   |

## Deliberate choices

- One generic message for a wrong password and an unknown email; a different message only for an outage or missing
  configuration, which does not reveal whether an account exists.
- Real sign-in removes a leftover `mock-role` cookie. Sign out clears local cookies even when Supabase cannot be reached.
- No throttling of our own: Supabase limits attempts server side.
- Sign-in runs in a server action, so the browser never calls Supabase directly; the CSP `connect-src 'self'` is not touched.
  TASK-025 should confirm this against the live service.
