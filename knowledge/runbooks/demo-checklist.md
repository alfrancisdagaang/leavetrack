# Demo checklist and script (TASK-027)

Run on the **live URL**, from the **network you will demo on**, in a fresh private window per user. Tick each box and tell me the
result. Use the shared demo password (yours alone; never paste it anywhere).

Seed org chart: Sam (hr_admin) -> Hana (hr_admin) -> Marco (manager) -> Elena, Jun; Hana -> Priya (manager) -> Leo.

## Before you start

- [ ] `/login` shows the email and password form and **no mock card** (mock login is off).
- [ ] Seed re-run on staging (October requests exist).

## AC1: each role signs in and sees only its own data

| User               | Expect                                                                                             | OK  |
| ------------------ | -------------------------------------------------------------------------------------------------- | --- |
| `elena.cruz@...`   | Dashboard; balances Vacation, Sick; own request (21-23 Oct) on the calendar; **no** approvals link | [ ] |
| `marco.santos@...` | Pending approvals card; queue has Jun's requests and Elena's; calendar shows Marco, Elena, Jun     | [ ] |
| `hana.reyes@...`   | Approvals queue has Marco's and Priya's requests; audit page opens; calendar shows everyone        | [ ] |
| `leo.garcia@...`   | Own request (9-10 Nov) only; no approvals link; calendar shows only Leo                            | [ ] |

(Emails end in `@leavetrack.example`.)

## AC2: Marco never sees Leo's request

- [ ] Signed in as Marco, Approvals lists **no** Leo Garcia request (Medical appointment, 9-10 Nov), and the calendar has no Leo bar.

## AC3: an email with no `users` row gets no session

1. In Supabase, Authentication -> Users, add a user `nobody@example.test` with any password (you choose; never share it).
2. [ ] Sign in with it: you see "not set up" (or the generic error) and **no dashboard**; reloading `/dashboard` goes to `/login`.
3. Delete that Auth user afterwards.

## AC4: mock login value

- [ ] `ALLOW_MOCK_LOGIN` on Vercel is `false` or unset. Tell me, and I record it in the handoff.

## TASK-025 live checks (still unreported)

- [ ] DevTools -> Application -> Cookies: `sb-*-auth-token` shows **HttpOnly** and **Secure**, and `SameSite=Lax`. Tell me the three values.
- [ ] DevTools -> Console after sign-in: **no** CSP error. A `404` for `/favicon.ico` is known and harmless.
- [ ] Sign out, then sign in again once (an old browser keeps the old cookie until it is rewritten).

## Demo script (about 5 minutes)

1. **Say first:** all data is fake; people sign in with their own email and password; the seven demo accounts share one demo password.
2. **Elena:** dashboard and calendar, then Request Leave (submit a short request), then My Balance.
3. **Marco** (second window): the new request is in his queue (the manager's notification). Approve one, reject another with a note.
4. **Elena:** balance and request status updated.
5. **Hana:** audit history shows each decision: who, what, when. Show the accrual with a manual trigger (a GET to `/api/jobs/accrual`
   with `Authorization: Bearer $CRON_SECRET` from your own shell; its first scheduled run is 1 Nov 00:00 UTC).
6. **Say plainly:** HR creating users, forced password change, emailed invites, "forgot password", email notifications and HR policy
   editing are not built; an HR override for over-balance requests is not defined yet (such a request can only be rejected).
7. If a page hangs, refresh once; if sign-in fails, use the rollback in [staging-rollout.md](staging-rollout.md).
