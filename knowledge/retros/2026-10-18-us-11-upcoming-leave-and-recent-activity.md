# Retro — US-11 Upcoming leave and Recent activity (TASK-031, TASK-032), 2026-10-18

Scope: the two cards below the dashboard calendar, from Figma 14:9341 / 14:9376 (desktop) and 14:9638 / 14:9673 (mobile).
Read-only, no migration, no write path touched, `proxy.ts` untouched.

## Decisions (2026-10-18, lean defaults the user accepted by saying "apply")

- Pending requests are listed in Upcoming (the demo data is nearly all pending). Role scope is the calendar's: employee own,
  manager own plus direct reports (`u.manager_id`), HR everyone. A request under way today still shows; its tile shows today.
- Upcoming and Recent activity show at most five rows (Figma shows three).
- **No row link, no chevron, no "View all"** until `/requests/[id]` exists (a chevron with nowhere to go reads as a broken link).
- Recent activity scopes by the **owner** of the request, not the actor, and does not filter `is_deleted` (a cancelled request's
  `soft_deleted` event is the "Cancelled" item). Cancel is not built, so none exists yet; it renders with the X icon and a muted label.
- Two colour tokens added (`--color-event-approved`, `--color-event-rejected`) to match Figma's labels without hard-coded colours.

## What changed

- New: `src/lib/leave/{upcoming,activity,format}.ts`, `src/components/ui/{upcoming-leave,recent-activity}.tsx`, icons `send`, `x`,
  `check` (Figma, unedited), tests for each, and the gated `dashboard-lists.integration.test.ts`.
- Modified: dashboard `page.tsx`, `sections.tsx`, `skeletons.tsx`, `sections.test.ts`, `globals.css`, PRD US-11, CSV TASK-031 and 032.

## Acceptance criteria (PRD US-11)

| AC  | Criterion                                                               | Result | Evidence                                                                                                                       |
| --- | ----------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------ |
| AC1 | employee: own pending and approved, not ended, soonest first, max five  | PASS   | real Postgres engine (10/10) and browser as Elena: only her request; HR list shows exactly five, soonest first                 |
| AC2 | manager: own plus direct reports only; another team (Leo) never appears | PASS   | real engine: Marco gets Elena, Jun, himself; Priya gets Leo; browser as Marco: no Leo (9 Nov), no Priya (28 Oct)               |
| AC3 | HR: everyone                                                            | PASS   | real engine and browser as Hana: all teams, Priya and Marco included                                                           |
| AC4 | rejected, cancelled, finished never listed; one under way still is      | PASS   | real engine fixtures (rejected, soft-deleted, ended, under way); unit test for the tile showing today                          |
| AC5 | newest first, max five, who/what/type/dates/time in the app time zone   | PASS   | real engine (order, limit, actor vs owner); format tests for `Asia/Manila` vs UTC; browser "Today, Oct 18 · 2:06 PM"           |
| AC6 | status written as text                                                  | PASS   | component tests (Pending, Approved, Submitted, Approved, Rejected, Cancelled labels)                                           |
| AC7 | failed read says not available without breaking the page; empty says so | PASS   | section tests (rejected read), component tests; seen live when the harness failed reads: the rest of the page still loaded     |
| AC8 | usable at 375 and 320 px with no horizontal scroll                      | PASS   | headless Chrome, three roles: `scrollWidth` equals `clientWidth` at 375, 320 and 1440; cards 343 w stacked, 560 w side by side |

## Verification (mine)

- Gate in the repo: `lint`, `format:check`, `typecheck` clean; `npm test` 414 passed, 24 skipped (was 369 / 14; the 10 new skips are
  the gated integration tests).
- Integration tests on pglite (migrations only): 10 of 10 pass on a fresh database. With the manager filter of the activity query
  broken, exactly the two manager-scope tests fail; the file was restored and `diff`ed.
- `npm run build` passed in a throwaway copy; browser check on that build, mock login as employee, manager and HR, seeded database.
  Only console error: `/favicon.ico` 404 (already in the backlog).

## Not verified

- Nothing on Vercel or the real Supabase database. `APP_TIMEZONE` is still unset on Vercel, so "Today" and the times use UTC there.
- The first browser run showed random "not available" sections: pglite's single session (see the pattern note), not the code. A
  pool of one in the throwaway copy fixed it, and the repo's `max: 5` is unchanged. Real Postgres has no such limit, but I did not
  test five parallel queries against it (the handoff already records the pool budget: a manager's dashboard now issues up to five).
- The Figma has no empty, error, employee or HR frames; those are my own choices.

## Backlog

- The seed gives all audit rows one timestamp, so Recent activity on staging shows only "Submitted" until someone decides a
  request in the demo (then Approved or Rejected appears). Expected, not a bug; decide a request before the demo if you want variety.
- The integration test's exact lists need a fresh database. When `TEST_DATABASE_URL` is wired into CI (already open), give each
  integration file its own database or make the HR assertions independent of other rows.
- Row links, the chevron and "View all" come back with the request details page (`/requests/[id]`).
- Set `APP_TIMEZONE=Asia/Manila` on Vercel before the demo (the user's step).
- `/favicon.ico` 404 (add `src/app/icon.svg`).
