# ADR-LeaveTrack-E003 — Real Sign-In

**Status:** Accepted (2026-10-15)

## Context
Day 0 used a mock cookie session (`ADR-LeaveTrack-E001`): any login input is accepted and a `mock-role` cookie is the whole session. The supervisor expects real sign-in at the 2026-10-19 demo (PRD US-09). Open decision 5 (real login provider) is closed here.

Constraints: the app already runs on Supabase Postgres and Vercel; the seeded users have fake `@leavetrack.example` emails that must keep working for the demo; nobody should be able to sign up on their own; email delivery is not available (Supabase's built-in sender is rate-limited, and custom SMTP is not set up).

## Options Considered
1. **Google sign-in through Supabase Auth.**
   - Pros: no passwords to manage.
   - Cons: needs real Google accounts, so the fake demo emails could never sign in; needs a Google Cloud OAuth client and redirect URLs that must match the Vercel domain.
2. **Google sign-in through Auth.js.**
   - Pros: no Supabase Auth dependency.
   - Cons: same real-account limit; a second auth system beside Supabase.
3. **Email and password through Supabase Auth (chosen).**
   - Pros: works for any email including the fake demo ones; no external provider setup; accounts live in the same Supabase project; sign-up can be disabled so only emails HR has added can exist.
   - Cons: passwords exist. With no email delivery, the demo accounts share a password the owner chooses and hands over directly.

## Decision
Option 3. Supabase Auth issues and refreshes the session (`@supabase/ssr`, httpOnly cookies). The Supabase account proves who someone is; the `public.users` row says what they may do. The two are linked by `lower(email)` (the unique index `users_email_lower_key` already exists), so no migration is needed.

- `getSession()` keeps its return shape `{ role, user }`, so every page, route handler, `requireRole`/`assertRole` call and SQL scoping rule is unchanged. It now reads the Supabase session and resolves the email to a `users` row with one SQL lookup per request. No row means no session.
- Sign-up is disabled in the Supabase dashboard. Accounts for the seeded users are created by a local-only script that uses the service-role key from the environment; the key is never an app or Vercel variable and is never committed or logged.
- The mock login stays only as a labelled fallback, honoured only when `ALLOW_MOCK_LOGIN` is true. With the flag off the `mock-role` cookie grants nothing.
- A voluntary change-password page is included; nothing forces a change at first sign-in and nothing is emailed.

## Corrections to ADR-LeaveTrack-E001
E001 says Day 1 "only replaces how the cookie gets set". That was incomplete. `getSession()` keeps its contract, but `src/proxy.ts` and the login action also change: the role cookie can no longer be the source of truth, because a real session must identify the person, and the role has to come from the `users` table. The ARCH "session cookie unchanged shape" note is superseded by this ADR.

## Consequences
- Positive: real, distinct identities for every seeded user; manager scoping is by the signed-in person's own id; the fake demo emails keep working; no external provider setup.
- Negative: the demo accounts share one password; anyone who knows the shared password and a colleague's email can sign in as that colleague, so it must be treated as a demo credential. An extra SQL lookup per request. If `ALLOW_MOCK_LOGIN` stays on at a public URL, anyone with the URL can still pick a role, so it must be switched off after the demo.
- Out of scope (after the demo): HR creating users on screen, a forced password change at first sign-in, emailed invites (needs custom SMTP), deactivating users who leave, and a "forgot password" flow.
