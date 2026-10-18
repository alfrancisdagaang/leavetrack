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

Run the whole of `supabase/seed.sql` once. It is idempotent: safe to run again. It now adds four pending requests in October and
early November, so the calendar and the queues have something to show. Nothing is deleted or changed.

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
