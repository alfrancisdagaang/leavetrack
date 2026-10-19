# Retro: TASK-040, over-balance states and override in history (EPIC-6)

The read side of the HR override. Not committed or pushed. Needs TASK-037 (schema), TASK-038 (route) and TASK-039 (HR page).

## What shipped

- `src/lib/leave/over-balance.ts`: one pure rule, `checkOverBalance`, shared by every page: `ok`, `over` (tracked type, a balance row, `0 <= balance < working days`, against the CONFIRMED balance, shortfall exact to the hundredth), `no_balance_record`, `negative`. It matches the HR override queue and the TASK-038 route, so a page never says "waiting for HR" for something HR cannot override.
- **Manager** (`team.ts`, `team-member.ts`, `approval-row.tsx`, `member-requests.tsx`, `balance-text.ts`, `ApprovalActions`): `insufficient` became `balanceCheck`. An over-balance pending request shows "Over balance by N days" and "Waiting for HR override" with **Reject only** (Approve is not rendered at all, new `showApprove` prop). No-record and negative balances say so, ask HR to fix the balance, Reject only. In-balance requests keep Approve and Reject.
- **Decide message** (`decide.ts`): the 409 now says it needs an HR override and where HR does it (replaces "not available yet"); a negative balance gets its own message that does not promise one.
- **Employee** (`balance-requests.tsx`, `balance-section.tsx`): a pending request over the confirmed balance reads "Waiting for HR override: over your balance by N days."
- **History:** an `overridden` flag (an `exists` on `audit_log` for `override_approved`, inside each existing statement) in the audit list (`audit-list.ts`, `audit-format.ts`, `audit-table.tsx`), the team member page, the manager's Recently decided, and the employee's own list (`service.ts`; additive field in the `/api/leave-requests` response). An override approval reads "Approved (HR override)" everywhere (`requestBadge`). The audit buckets still come from the request status, so they add up.

## Decisions (the user chose or accepted)

- The employee's own list also shows "Approved (HR override)" (the user asked: "Employees wont get know if hr override complete?"; added to the plan, then applied). Manager's Recently decided too. Hide Approve entirely (not disabled). No-record and negative balances are Reject only with their own message. The employee page reads a missing balance row as 0 confirmed (the shared summary does), so such an employee is told "waiting for HR override" for something HR cannot override; seeded users all have rows, so left as is.

## Found

- **A horizontal scroll bug on the manager's pages at 375 and 320 px** (454 and 458 px wide) when an employee's reason has a long unbroken word. It came from the older manager row (`approval-row.tsx`) and member page (`member-requests.tsx`), not from this task's code, but those are the pages this task changes and the criterion covers them. Found only because the browser data had a long word in a reason. Fixed with `min-w-0` and `break-words`; two tests fail without the fix. The HR page already wrapped.
- Approving an override sets the balance to 0, so the employee's other pending requests turn over-balance (already noted in TASK-039).
- A test of mine asserted the word "disabled", which also appears in the button's CSS (`disabled:` variants); it now checks the attribute.
- **Mutation proofs:** 14 mutations on the code, all caught by a test (details below).

## Validation

- Real PostgreSQL 18.4, seedless fresh database: `override-states.integration.test.ts` 7/7 (the states for each kind of request on the queue and the member page; the shared rule agreeing with the HR queue; the override flag in the team member page, Recently decided, audit list with buckets adding up, and the employee's list). The four override gated files passed one after another on one database (3, 10, 10 and 7 tests).
- Mutations, 14, all caught: `shortfall <= 0` to `< 0`; the negative branch removed; the no-record branch removed; the audit-action filter changed in each of the four reads (`team.ts`, `team-member.ts`, `audit-list.ts`, `service.ts`; each caught by the real-engine test and by a unit test); Approve shown on the manager row and on the member page; `showApprove` ignored in `ApprovalActions`; the employee note shown on decided requests; the override badge on every approval; the audit badge; the negative message in `decide.ts`. Every file restored (`cmp`).
- Browser (headless Chrome against a throwaway production build and a seeded Postgres, mock session): 31 of 31 checks. Manager: over-balance rows say Waiting for HR override with Reject only, an in-balance row keeps Approve and Reject, the member page shows the same; employee: My Balance says "Waiting for HR override: over your balance by 5 days"; HR approves in the UI and then the manager's Recently decided, the member page, the employee's My requests and HR's Audit History all read "Approved (HR override)" and the waiting note disappears; no horizontal scroll at 1440, 375 and 320 px on every page checked, before and after the override. Screenshots checked at 320.
- Gate: lint, format:check, typecheck, 850 tests passed (101 skipped without a database), `npm run build` passed in a throwaway copy and lists the routes. Port 3000 was held by the user's own server, so the browser run used 3100 and that server was not touched.

## Acceptance criteria

AC1 (a manager sees the shortfall and only Reject on an over-balance request, Approve and Reject on an in-balance one): PASS. AC2 (the employee sees it is waiting for HR override): PASS. AC3 (override approvals read "Approved (HR override)" in the audit list and Recent activity, buckets add up): PASS for the audit list in a browser and the buckets on a real engine; Recent activity was done in TASK-038 (unit tests) and was **not re-checked in a browser here**. AC4 (no horizontal scroll at 375 and 320 px, nothing by colour alone): PASS after the fix. **Not seen:** GitHub Actions, Vercel, real Supabase.

## Backlog

- The My team roster's "last request" badge still says "Approved" for a request HR overrode (`roster-row.tsx` uses `STATUS_BADGE`); not in the CSV.
- The employee page cannot tell "no balance row" from a balance of 0 (see Decisions).
- **The TASK-037 migrations are still not applied to the user's database** (see the TASK-039 retro and memory). Until they are, Team Approvals, the team member page, Recently decided, the audit list and My Balance fail on their new `overridden` subquery there, each showing its failure note. Apply them (after confirming the name `override_approved`) before relying on those pages.
- Mark TASK-040 `Done` in the CSV only when asked. Do not push TASK-037 to 040 until `override_approved` is agreed.
