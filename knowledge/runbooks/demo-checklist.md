# Demo checklist and script (TASK-027)

Run on the **live URL**, from the **network you will demo on**, in a fresh private window per user. Tick each box and tell me the
result. Use the shared demo password (yours alone; never paste it anywhere).

Three roles (EPIC-10). **Employees** request leave and see their balance. **Managers** approve or reject their direct reports'
requests. **HR admins** override over-balance requests and read the audit history; they have no team and no normal approvals.
Seed teams: Marco (manager) -> Elena, Jun; Priya (manager) -> Leo. Hana and Sam are HR admins. **Only employees have a
manager**: Marco, Priya, Hana and Sam have none, so they sit at the top of the organization chart.

**Known limitation (say it if asked):** a manager or HR admin who needs leave has no way to request it in LeaveTrack.

## Before you start

- [ ] `/login` shows the email and password form and **no mock card** (mock login is off).
- [ ] Seed re-run on staging (see [staging-rollout.md](staging-rollout.md) section 2): Elena has a pending **Sick** request of
      8 working days (23 Nov to 2 Dec) that is over her balance. This is the override demo.

## AC1: each role signs in and sees only its own data

| User               | Expect                                                                                                                                                  | OK  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| `elena.cruz@...`   | Dashboard; balances Vacation, Sick; own requests on the calendar; **no** approvals link                                                                 | [ ] |
| `marco.santos@...` | Pending approvals card; **no** Request Leave or My Balance; Team Approvals and My Team are separate sidebar items; queue has Jun's and Elena's requests | [ ] |
| `hana.reyes@...`   | "Awaiting HR override" card (1); Balance Overrides, Calendar and Audit History; **no** Team Approvals, no balance                                       | [ ] |
| `leo.garcia@...`   | Own request (9-10 Nov) only; no approvals link; calendar shows only Leo                                                                                 | [ ] |

(Emails end in `@leavetrack.example`.)

## AC1b: reporting lines (My Profile, Organization tab)

- [ ] `elena.cruz@...`: Marco above her, her card highlighted "You", "No direct reports".
- [ ] `marco.santos@...`: the tab reads "No manager: you are at the top of the chart" and lists Elena and Jun under him (no Priya, no Leo);
      the Overview tab says "No manager".
- [ ] `hana.reyes@...`: "The company" lists Hana, Marco, Priya and Sam at the top; Marco opens to Elena and Jun, Priya to Leo; "Your manager"
      says she has none.

## AC2: Marco never sees Leo's request

- [ ] Signed in as Marco, Approvals lists **no** Leo Garcia request (Medical appointment, 9-10 Nov), and the calendar has no Leo bar.

## AC2b: roles are limited to what the docs define (EPIC-10)

- [ ] Signed in as Marco or Hana, `/requests/new` and `/balance` go back to the dashboard.
- [ ] Signed in as Hana, `/approvals` and `/approvals/team` go back to the dashboard.
- [ ] Signed in as Marco, `/approvals/overrides` goes back to the dashboard.

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
   Three roles: employees request leave, managers approve for their own team, HR overrides and audits.
2. **Elena:** dashboard and calendar, then Request Leave (submit a short request), then My Balance. Point out "Waiting for HR
   override: over your balance by N days" on her Sick request (N is 3 on a fresh seed, 2 on staging after one accrual run).
3. **Marco** (second window): the new request is in his queue (the manager's notification). Approve one, reject another with a
   note. Elena's Sick request says "Waiting for HR override" and offers **Reject only**.
4. **Hana** (third window): the dashboard card says one request is awaiting an override. **Balance Overrides:** approve Elena's
   Sick request. Her Sick balance becomes 0 and the shortfall (3 days on a fresh seed, 2 after one accrual run) is recorded.
5. **Elena:** balance and request status updated; the request reads "Approved (HR override)".
6. **Hana:** audit history shows each decision: who, what, when (submitted, then override approved). Show the accrual with a manual
   trigger (a GET to `/api/jobs/accrual` with `Authorization: Bearer $CRON_SECRET` from your own shell; its first scheduled run
   is 1 Nov 00:00 UTC).
7. **Say plainly:** HR creating users, forced password change, emailed invites, "forgot password", email notifications and HR policy
   editing are not built. Older requests from managers and HR admins (before the three-role change) stay as history.
8. If a page hangs, refresh once; if sign-in fails, use the rollback in [staging-rollout.md](staging-rollout.md).
