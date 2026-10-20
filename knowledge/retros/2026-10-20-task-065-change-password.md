# Retro: TASK-065, change password (EPIC-11; supersedes TASK-026)

Built and validated locally, **not committed, not pushed**. No migration, no role or required-feature change, nothing under `docs/` touched. TASK-026 stays `Superseded` (its CSV row already says so).

## What shipped

- **Route** `POST /api/account/password` (`withErrorHandling`, zod, rule 11). Order: no session gives 401; a session that is not a real Supabase one gives 403 "Password change is not available with the demo login."; body parsed by `password-schema.ts` (8 to 72 characters, confirmation equal, new differs from current, never trimmed); then `changePassword` (`src/lib/auth/change-password.ts`). The account is the SESSION's email, never a body field (a test sends a foreign `email` and asserts it is ignored). Any role may call it. `Cache-Control: no-store`.
- **Service:** (1) `signInWithPassword` with the current password (a credential error is one generic 400, "Your current password is incorrect."; any other upstream error is a 503); (2) `updateUser` (`weak_password` and `same_password` become 400, anything else 503); (3) `signOut({ scope: "others" })`, best effort: a failure there is logged as a warning and the change still succeeds, because the password has already changed.
- **`getSessionSource()`** (`session.ts`): `"supabase" | "mock" | null` from the SAME cached resolution as `getSession()` (no second lookup). `getSession()` returns exactly what it did; the existing session tests are the guard. It grants nothing.
- **Logger:** `current_password`, `new_password`, `confirm_password` added to `SECRET_KEYS`.
- **UI:** shared `src/components/ui/password-input.tsx` (label, hint, error, show/hide, 44 px toggle, `aria-describedby`/`aria-invalid`), used by the sign-in field (now a thin wrapper, same markup and tests) and by `password-form.tsx` (reusable by EPIC-8's `/set-password`). The Account settings tab shows a Security card; a mock session sees "Password change is not available with the demo login." and no form. Length, match and "same as current" are checked in the browser first so common mistakes answer at once; the route checks everything again.

## Validation

- **Gate (exit codes read):** lint 0, prettier 0, tsc 0, `npm test` 0 (**1,225 passed, 180 skipped** before this retro), build 0 in the repo and again on a throwaway copy without `.env.local` (`diff -rq src` clean).
- **Unit and route tests:** schema (edges 7, 8, 72, 73, spaces kept, no value in a message), route (401, mock 403, success for the session's own email, all three roles, four invalid bodies, bad JSON, wrong current, outage, no password in any response or log line), service against a **fake Auth server** (a local HTTP server with one account: call order token, user, logout?scope=others; the new password signs in afterwards and the old one does not; wrong current changes nothing; weak password; outage at each step; sign-out failure still succeeds; no password in a log line), input and form markup, page (real and mock session), session source, logger.
- **Mutation proofs: 17 of 17 caught** (files restored and `cmp`'d): mock allowed, no session check, current password not re-checked, global sign-out, other sessions never signed out, a sign-out failure failing the change, wrong password reported as an outage, same password allowed, confirmation not compared, minimum 6, maximum 100, `new_password` and `current_password` not redacted, source always "supabase", form shown to a mock session, passwords written to `localStorage`, toggle turned into a submit button.
- **Browser** (headless Chrome, production build of the final code, seeded PostgreSQL 18.4, a fake Supabase Auth server behind `NEXT_PUBLIC_SUPABASE_URL` so the REAL sign-in path ran, one context per user): **49 checks, 0 failed** at 1440, 768, 375 and 320 px. Real sign-in as Elena, Marco and Hana; labels, 44 px targets, no sideways scroll (also with an error showing); keyboard only (Tab to the toggle, Space shows and hides); short, mismatched and same-as-current answered inline with **no request to Auth**; wrong current password: generic inline error, nothing changed; an Auth outage on the update: "unavailable", nothing changed; success: `role="status"`, fields cleared, no alert left, this device stays signed in, **a second device is signed out**, the old password no longer signs in and the new one does, no password in the page; a mock session sees the explanation and no form and the route answers 403 in the envelope; a visitor gets 401 and the page redirects to `/login`; no CSP violation or script error (only the deliberately provoked 400, 403 and 503 answers appear in the console). The production server's own log contained no password. Screenshots at 1440 and 375 looked at.

## Found during validation

- No product defect. Harness slips only: the fake Auth server counted its own `/__state` reads as calls, and its "fail the next call" matched the proxy's `GET /user` instead of the `PUT`; both fixed in the harness, not in the app.

## Not seen

Real Supabase (the fake server proves our calls and their order, not Supabase's behaviour, such as `signOut({ scope: "others" })` really ending other sessions, the exact error codes, or the project's own minimum password length), GitHub Actions, Vercel, a screen reader.

## Decisions taken (defaults, no objection)

1. `getSessionSource()` as a second export, not a field on `Session`. 2. No app-side rate limit (Supabase rate-limits sign-in). 3. Our minimum is 8; if the project's is higher, Supabase's `weak_password` answer shows as the "too weak" message.

## Backlog (nothing blocking)

- The error alert is not tied to the field it is about (one alert under the form, no `aria-describedby` on the form).
- Re-authenticating makes one extra Auth round trip per change; fine for a rare action.
- Rate limiting wrong current passwords is left to Supabase; a stolen session could still guess the current password at Supabase's rate.
- `signOut({ scope: "others" })` is not yet proven against a real project: check once on staging (sign in on two browsers, change the password on one, the other must be asked to sign in).
- **STAGING STEP FOR THE USER:** check the Supabase project's minimum password length and "secure password change" (Authentication, Sign In / Providers, Email).
