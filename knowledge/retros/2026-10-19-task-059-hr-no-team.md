# Retro: TASK-059, HR Admin has no team and no normal approvals (EPIC-10)

Not committed or pushed (TASK-058 is also uncommitted in the same tree). TASK-060 (seed and demo data) is next.

## What shipped

- `src/lib/auth/roles.ts`: `canApproveLeave(role)` (manager only) and `APPROVERS_ONLY_MESSAGE`.
- **Decision route:** `POST /api/leave-requests/[id]/decision` refuses anyone but a manager (403, standard envelope, clear message). `GET ?scope=team` is manager only.
- **Service (rule 3, the SQL path):** `decideLeaveRequest` reads the decider's role from `users` first, inside the transaction, and refuses before anything is locked or written. The `u.manager_id = decider` scope is unchanged, so a manager still decides only for direct reports. This matters because the data still has Hana as `manager_id` of Marco and Priya: without the check she could still decide their requests.
- **Pages:** Team Approvals, My team and the team member page use `requireRole("manager")`; HR is redirected to `/dashboard`. The override page stays HR only.
- **Nav:** manager = Dashboard, Team Approvals; HR = Dashboard, HR Overrides, Audit History.
- **HR dashboard:** one "Awaiting HR override" card from the new `getOverrideCount` (one statement, the queue's conditions). It replaces the summary read, so the HR dashboard stays at 4 parallel statements. The calendar, Upcoming leave and Recent activity are unchanged (company-wide for HR).

## Removed behaviour (for the supervisor and the TASK-061 retro)

An HR Admin can no longer approve or reject a request, see Team Approvals or My team, or have a "Pending approvals" card. HR decides only through the override (over-balance requests) and reads the audit list. **Known limitation (unchanged from TASK-058):** a manager or HR Admin who needs leave has no way to request it.

## Decisions (accepted with the plan)

- The decider's role is also checked in SQL (one extra statement in the write transaction).
- A new count statement, not the queue's `total`: it repeats the over-balance rule a third time, so a gated test compares it with the queue.
- The seed hierarchy (Hana manager of Marco and Priya, Sam of Hana) is unchanged until TASK-060.

## Validation

- **Real PostgreSQL 18 (embedded), migrations only:** `decide-role.integration.test.ts` 4/4 (HR who is the employee's `manager_id` refused, request stays pending with no audit row; the manager still approves; another team's manager still refused; a role change takes effect at once), `override-count.integration.test.ts` 3/3 (count equals the queue total for over-balance, in-balance, negative, Unpaid, no-row, own and soft-deleted requests). All 14 gated files under `src/lib` passed together (98 tests); `dashboard-lists` passed alone (10/10) on its own database.
- **Mutations, 9, all caught and restored (`cmp`):** decider-role check removed (5 failed, 3 on the real engine); decision route gate removed; `scope=team` open to HR; Team Approvals page open to HR; Team Approvals in HR's nav; count without the over-balance condition; count without the own-request exclusion; count without the soft-delete filter; the override card shown to every role.
- **Browser (headless Chrome, throwaway production build, seeded Postgres, mock sessions) as Marco and Hana at 1440, 375, 320:** HR nav has no Team Approvals; direct `/approvals`, `/approvals/team` and `/approvals/team/<id>` redirect HR to `/dashboard` and load for Marco; Marco is redirected away from `/approvals/overrides`; HR's card reads "Awaiting HR override 1" after Elena submitted a 12-day request against a 10-day balance, and drops to 0 after the override; HR decision API 403 with the clear message, `scope=team` 403 for HR and 200 for Marco; Marco still approves a direct report (200) and gets 409 on an already-approved request; HR override still 200; no horizontal scroll on the dashboard, the manager pages and the override page. Screenshot of the override page at 375 checked.
- **Gate:** lint, format:check, typecheck clean; 872 tests passed, 112 skipped (gated); `npm run build` passed in a throwaway copy.

## Acceptance criteria

AC1 (an HR Admin cannot decide a normal request, 403): PASS (route, service SQL path, real engine, browser). AC2 (no Team Approvals or My team for HR, redirected if opened): PASS (nav and three direct URLs in a browser). AC3 (HR still sees the dashboard, audit list, override page and a calendar): PASS for the dashboard (with its company-wide calendar) and the override page in a browser; the audit list is unchanged and its own tests pass, but I did not open it in a browser this time; the dedicated HR calendar is EPIC-7. AC4 (a manager's approvals and team views unchanged): PASS (pages load, no scroll, approve works, scope still enforced). **Not seen:** GitHub Actions, Vercel, real Supabase.

## Backlog

- **Orphaned pending requests.** Nobody can now decide a pending request left by Marco, Priya, Hana or Sam (their approver is HR or a top-level HR admin). They stay Pending in history, and show in the audit list. Staging data is untouched; TASK-060 or a soft-delete migration the user agrees to has to deal with them.
- The HR welcome subtitle can say "N requests wait for an override", but the dashboard page passes `null`, so it shows only the base sentence. Wiring it in would add a read to the page.
- The browser run was one-way on state: Marco's approval of Elena's request in the 1440 pass meant the later HR 403 test used an already-approved request; the 403 comes from the role check first, so the result stands.
- Mark TASK-059 `Done` in the CSV only when asked.
