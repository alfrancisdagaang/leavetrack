# Runbook: staging rollout for the demo (TASK-027)

Puts the live system (Vercel + Supabase staging) into its demo state. Every step here is **yours**: it happens in a dashboard or
your own shell. No secret goes into chat, a file or a commit.

**Decision (2026-10-18): the mock login is OFF on the demo URL.** Only real sign-in works. Rollback is at the bottom.

## 1. Supabase (dashboard)

1. Authentication -> Sign In / Providers -> turn **"Allow new users to sign up" off**.
2. Authentication -> URL Configuration -> set **Site URL** to the Vercel domain (`https://leavetrack-seven.vercel.app`).
3. Confirm the seven demo accounts exist (Authentication -> Users). If not, or if the shared password is lost, run
   [seed-auth-users.md](seed-auth-users.md) from your own shell.

## 2. Demo data (Supabase SQL editor)

Run the whole of `supabase/seed.sql` once. It is idempotent: safe to run again. Nothing is deleted. One thing is changed on a
database seeded earlier: Hana, Marco and Priya's old manager (Sam, then Hana) is cleared, because only employees have a manager
(the organization chart then shows managers and HR admins at the top). Re-run it before the demo if you saw Sam above Hana.

**Three roles (EPIC-10).** The seed gives leave policies, balances and requests to **employees only**. On a database seeded earlier
it adds one request: Elena's pending **Sick** request of 8 working days (23 Nov to 2 Dec), over her balance, for the HR override demo.
What it does **not** do, by design (rows cannot be hard-deleted, and nothing is changed without your say-so):

- The older pending requests from **Marco, Priya and Hana** (and any from Sam) stay as history. Nobody can decide them now (managers
  no longer have an approver in HR, and HR no longer approves normal requests), so they stay Pending in the audit list. List them
  (read-only):

  ```sql
  select r.id, u.name, u.role, r.status, r.start_date, r.end_date
  from public.leave_requests r join public.users u on u.id = r.user_id
  where u.role <> 'employee' and r.status = 'pending' and r.is_deleted = false;
  ```

  If you want them out of the lists, that is a separate soft-delete data migration (`is_deleted = true`; the audit rows stay).
  Decide before running one.

- Old balances and leave policies of managers and HR admins stay. No page shows them, but the monthly accrual keeps crediting them.

## 3. Vercel (project settings -> Environment Variables)

| Variable           | Value                     | Why                                                  |
| ------------------ | ------------------------- | ---------------------------------------------------- |
| `ALLOW_MOCK_LOGIN` | remove it, or set `false` | The mock role picker must not exist on the demo URL. |
| `APP_TIMEZONE`     | `Asia/Manila` (optional)  | The calendar's "today" uses UTC when unset.          |

Then **redeploy** (a variable change does not apply to an existing deployment). Open `/login`: it must show the email and password
form and **no** mock card.

## 4. One-off clean-up

- Rotate the API key in `.mcp.json` (git-ignored, but it is live).
- Keep the shared demo password in a password manager. Give it to attendees directly.

## 5. Check it

Work through [demo-checklist.md](demo-checklist.md) on the live URL, from the network you will demo on. Tell me which items
pass or fail; I record the result in `knowledge/HANDOFF.md` (including the `ALLOW_MOCK_LOGIN` value, TASK-027 AC4).

## Rollback: real sign-in fails on the demo network

1. Vercel: set `ALLOW_MOCK_LOGIN=true`, redeploy.
2. Demo the labelled mock fallback and **say so plainly**: the login is a mock (Elena, Marco or Hana only).
3. Switch it off again after the demo.

## If a page hangs

Look in Vercel Logs for `Retrying read query` and `Database query hit its deadline` (HANDOFF section 0a). After a database password
change, update all four places: Vercel `DATABASE_URL`, GitHub `SUPABASE_DB_URL` (production Environment), `.env.local`, and any other copy.
