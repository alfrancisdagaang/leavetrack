# Retro: TASK-058, only Employees can request leave (EPIC-10)

Not committed or pushed. TASK-059 (HR Admin has no team and no normal approvals) is next.

## What shipped

- `src/lib/auth/roles.ts`: `canRequestLeave(role)` (employee only) and the one FORBIDDEN message, shared by the route, service, nav, dashboard and pages.
- **Service (rule 3, the SQL path):** `createLeaveRequest` selects `role` in its existing user statement and throws FORBIDDEN before the "no approver" check, so a top-level HR admin (Hana) is told why instead of "no approver is assigned". The role comes from the `users` row, not the caller: a role change takes effect on the next call.
- **Route:** `POST /api/leave-requests` refuses manager and hr_admin (403, standard envelope, clear message). `GET ?scope=mine` is employee-only too (not in the CSV; decided in the plan). `scope=team` is unchanged.
- **Pages:** Request Leave and My Balance use `requireRole("employee")` and redirect others to `/dashboard`.
- **Dashboard:** the Request Leave button and the three balance cards are employee-only; managers and HR see one "Pending approvals" card (HR keeps it until TASK-059). Welcome subtitle for them is now "Your team's leave and approvals, at a glance."
- **Nav:** employee = Dashboard, Request Leave, My Balance; manager = Dashboard, Team Approvals; hr_admin = Dashboard, Team Approvals, HR Overrides, Audit History.

## Removed behaviour (for the supervisor and the TASK-061 retro)

Managers and HR Admins can no longer request leave, see My Balance or see balance cards. **Known limitation:** a manager or HR Admin who needs leave has no way to request it in LeaveTrack. Staging data is untouched: their old requests (Hana, Sam, Marco, Priya) stay as history and still appear in audit lists and queues.

## Validation

- **Real PostgreSQL 18 (embedded), migrations only:** `request-role.integration.test.ts` 4/4 (a manager with an approver and a balance row refused with nothing written; a top-level HR admin refused with FORBIDDEN, not CONFLICT; an employee still gets a pending row and a submitted audit row; a user refused right after being changed to manager). The other 10 gated override/team/balance files: 88 of 88 passed together; `dashboard-lists` passed alone (10/10) on its own fresh database.
- **Mutations, 6, all caught and restored (`cmp`):** SQL-path role check removed (6 tests failed, 3 of them on the real engine); POST route gate removed; `scope=mine` gate removed; balance cards shown to everyone; nav offers Request Leave to managers; My Balance page open to all roles.
- **Browser (headless Chrome, throwaway production build, seeded Postgres, mock sessions) as Elena, Marco, Hana at 1440, 375, 320:** nav links, dashboard cards, direct `/requests/new` and `/balance` (employee loads, manager and HR land on `/dashboard`), no horizontal scroll on the dashboard (and on both employee pages). API as each role at 1440: employee POST 201, `mine` 200, `team` 403; manager and HR POST 403 with `{success:false, error:{code:"FORBIDDEN", message}}`, `mine` 403, `team` 200. Screenshots of manager at 1440 and HR at 320 checked.
- **Gate:** lint, format:check, typecheck clean; 864 tests passed, 105 skipped (need a database); `npm run build` passed in a throwaway copy.

## Acceptance criteria

AC1 (a manager or HR Admin cannot create a request through the API or the page, clear message): PASS (route, service SQL path and real engine). AC2 (not offered, redirected if opened): PASS (nav, button, cards, direct URLs in a browser). AC3 (employees unaffected): PASS (201 on the API, pages load, existing gated suites pass). AC4 (existing tests updated, gate passes): PASS. **Not seen:** GitHub Actions, Vercel, real Supabase.

## Found

- My first browser probe reported 6 false failures: it searched the dashboard text for "Vacation, Sick, Unpaid", which also appear in the calendar, Upcoming leave and Recent activity. The real check is the card titles (`main h2, main h3`): managers and HR have only "Pending approvals".
- The CSV says the route gate "changes from the employee-only gate it already is"; it was open to all three roles before this task.
- A harness slip: one mutation command was malformed (multi-line shell argument). It changed nothing; the file was restored from the backup and compared before the next run.

## Backlog

- A single summary card is one third wide on desktop (the grid is the three-column layout). Fine for now; TASK-059 and EPIC-7 change what HR sees there.
- Upcoming leave and Recent activity still show a manager's or HR Admin's old requests as history (decided in the plan).
- The handoff and older retros still say "roles stack" (managers and HR may request leave); the READ FIRST section of the handoff should say it no longer holds. AGENTS.md has no such note, so it needs no edit.
- Mark TASK-058 `Done` in the CSV only when asked.
