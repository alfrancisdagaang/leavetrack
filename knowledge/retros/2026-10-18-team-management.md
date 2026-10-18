# Retro — EPIC-4 Team management: My Team and the team member page (US-12, US-13), 2026-10-18

Scope: TASK-033 to TASK-036. A manager sees their direct reports (`/team`) and opens one person (`/team/[userId]`) to review all of their
requests with filters, and to approve or reject pending ones with the existing controls. Read side only: **no migration**, `decide.ts` and
the decision route untouched, `proxy.ts` untouched, no shared component changed. The design is a ChatGPT mockup (no Figma). The PRD stories
US-12 and US-13 and `epic-4-team-tasks.csv` were written first (CSV statuses are still `Open`, the user marks them).

## Decisions (user, 2026-10-18)

- A **My Team** area (roster, then a page per person); Team Approvals stays the pending inbox.
- The employee's **free-text reason only on pending requests** (never on decided ones); a rejection's decision note always shows.
- The roster shows out today or next leave, pending count, Vacation and Sick days left, and the last request with its status.
- Filters: leave type, status, year (current plus two before), 25 per page, in the page address.
- **Built the same night, no cutoff time** ("there is no final decision that tomorrow is the demo"). `main` stays at `db2ff00` until the user says to commit.
- Defaults the user did not change: segmented radio filters in a GET form with an Apply button; "Reason:" for the employee and "Rejection note:"
  for the manager; a missing balance row is "0 days"; an out-of-range page shows a message; roster in name order; a new nav icon;
  "Employee" or "Manager" role text from the database.

## The docs question (can a manager see balances and sick leave?)

- **Requests of direct reports: supported** (BR-02 "view and approve or reject"; US-03 AC3 "view or act"; US-10 and US-11 already show them).
- **Balances outside a request: not covered and not forbidden.** BR-03 gives _employees_ their own balance. The only precedent is the approvals
  queue naming the balance of the requested type. No document treats sick leave as sensitive; "may hold medical details" is about the free-text reason.
- Built as asked, with the balances **isolated** (their own roster columns and cards) so they can be removed without touching the scoping, and one
  line added to the PRD roles section. **Needs HR or supervisor sign-off.** Questions to put to them: may managers see a report's Vacation and Sick
  balances? Is showing Sick requests and dates fine, as the queue and calendar already do? Is "reason only while pending" the right rule?

## What changed

- `src/lib/leave/team-roster.ts`: **one statement** for the whole roster, scoped by `u.manager_id = ${managerId}` in the SQL; subselects per person
  (out today, next approved leave, pending count, last request, balances, pending ranges); available days from `summarizeBalances`, so they equal My Balance.
- `src/lib/leave/team-member.ts`: **one statement**: a `member` CTE finds the person only if they report to the caller, and every other part (balances,
  pending ranges, filtered requests, the total count, the page of 25) joins that CTE. The reason is `case when status = 'pending' then reason end` in the SQL.
- `src/lib/leave/schemas.ts`: `parseTeamMemberQuery` (each filter value checked on its own; a bad one is ignored with a note) and `memberIdSchema`.
- Pages: `/team` (roster, states, skeleton, loading) and `/team/[userId]` (header, balance cards, filter form, table from `sm` up and stacked rows
  below, pagination, states, not-found, skeleton, loading). Approve/Reject is the existing `ApprovalActions`. Nav: "My Team" between My Balance
  and Team Approvals, with a new light-stroke `nav-user.svg`.
- Tests: schemas, both reads (unit and real engine), every component, both pages, nav, skeletons, and the query budget (1 statement each).

## Acceptance criteria

| #         | Criterion                                                               | Result | Evidence                                                                                                                                                                                                                          |
| --------- | ----------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-12 AC1 | Only my direct reports, name order, never myself or another team        | PASS   | real engine (Marco: Elena, Jun, Mia; Priya: Leo; HR: Marco and Priya); the scope proof fails 5 of 9 when removed; staging 53/53; browser as Marco and Hana                                                                        |
| US-12 AC2 | Out today or next leave, pending count, days left, last request         | PASS   | real engine per field (a pending or rejected request covering today is not leave); 3 proofs caught; days left equal My Balance (real engine and staging); browser                                                                 |
| US-12 AC3 | No reports gives an empty state                                         | PASS   | real engine, render test, browser on an empty-team database at 1440 and 375 px                                                                                                                                                    |
| US-12 AC4 | An employee is sent to the dashboard; no My Team item                   | PASS   | nav tests, guard tests; browser as Elena: `/team` and `/team/<Jun>` both end at `/dashboard`, no "My Team" in her page                                                                                                            |
| US-12 AC5 | A failed read says so with a retry, the rest works                      | PASS   | render tests; browser with the database stopped: one `role="alert"` and a Try again link                                                                                                                                          |
| US-12 AC6 | Usable at 375 and 320 px, nothing by colour alone                       | PASS   | browser, three roles, no horizontal scroll at 1440, 375 and 320; statuses written out                                                                                                                                             |
| US-13 AC1 | Name, balances and all non-deleted requests, newest start first         | PASS   | real engine; balances equal My Balance (real engine and staging); browser                                                                                                                                                         |
| US-13 AC2 | Filters by type, status and year; year overlap; kept in the address     | PASS   | real engine (incl. a request crossing New Year); status, year and deleted proofs caught; browser filters                                                                                                                          |
| US-13 AC3 | A bad filter value never causes an error                                | PASS   | parser unit tests; page test; browser `?status=bogus&year=1999&page=zz` shows a note and the list                                                                                                                                 |
| US-13 AC4 | Reason only on pending; rejection note always                           | PASS   | SQL `case`; real engine with reasons planted on decided rows; the proof (select the reason for all) is caught; the table refuses it too; browser: hidden text never shown, and after a rejection the employee's reason disappears |
| US-13 AC5 | Approve and reject here with the same rules                             | PASS   | browser: approve took pending 2 to 1 and Vacation 10 to 7; reject with a note shows "Rejection note: ..."; `decide.ts` is untouched (its own tests stay green). Audit rows not re-checked here                                    |
| US-13 AC6 | 25 per page, previous and next, the count                               | PASS   | real engine (25, then the rest, no overlap); browser: Jun has 33, "Showing 1 to 25 of 33", then "26 to 33 of 33", Next keeps the filter, page 9 gives a message                                                                   |
| US-13 AC7 | Another team, missing, deleted, malformed all give the same "not found" | PASS   | real engine: Leo, a missing person, himself, his manager, a peer and a stranger all null; the proof is caught; browser: six cases give identical text, title and status, with no leaks                                            |
| US-13 AC8 | A failed read says so; usable at 375 and 320 px                         | PASS   | render and page tests; browser error state with a Try again link and a back link                                                                                                                                                  |
| Budget    | At most 4 parallel statements per page                                  | PASS   | `query-budget.test.ts`: exactly 1 each; staging probe                                                                                                                                                                             |

## Verification (mine)

- **Gate** (re-run on the final code): `lint`, `format:check`, `typecheck` clean; **664 tests passed, 59 skipped** (the skipped are the gated real-database tests).
  `npm run build` passed in a throwaway copy (the user's `next start` was never touched).
- **Real engine (pglite), a fresh database per file:** roster 9, member 13, and the earlier files (breakdown 8, summary 5, leave-types 2, dashboard-lists 10, calendar 8) all pass.
- **Break-the-filter proofs** (break it, run on a fresh database, expect failures, restore, `diff`): **9 of 9 caught**, every file restored identical: roster scope (5 tests fail),
  roster pending count with deleted rows, roster out-today and next-leave ignoring the approved status, member scope (2), the reason for every request, the status filter,
  the year range, soft-deleted requests. **The first run caught 7 of 8: the out-today proof was NOT caught**, because nobody on the roster had a pending request covering today.
  I fixed the fixtures (Mia has a pending and a rejected request covering today and must not show as out) and added the next-leave proof; both are now caught.
- **Browser, production build in a throwaway copy, seeded in-memory Postgres:** Marco (roster, member page, filters, paging, six not-found cases, approve and reject, keyboard),
  Hana (roster), Elena (redirect), an empty-team database, the error state; at 1440, 375 and 320 px; screenshots reviewed against the mockup.
- **Contrast**, every text and background pair from the token values: all pass 4.5:1 except the avatar initials (4.31:1), see below. Keyboard: the back link, the filter radios, Apply,
  Clear filters and the Approve button are reachable with a visible 3 px outline; ArrowRight moves the choice inside a radio group.
- **Staging, read-only:** the equivalence matches **53 of 53** (every roster field and member page against figures computed from raw rows for all five managers and HR; Marco cannot open Leo, himself or
  his manager; Priya can open Leo; an employee's roster is empty). The page-load probe with the real pool: roster x6 and member page x6 clean, mixed navigation (Dashboard, My Team, member, My Balance,
  Approvals) x5 clean, 190 to 225 ms each, no retries, no deadlines, no warnings.

## Found during validation, and fixed

- A **test gap** (above): the roster's out-today filter could be broken without a test failing. Fixed.
- **Phone roster rows had no chevron**, so they did not look tappable (the mockup has one). Now shown top right on phones.
- **The member error card was a dead end** (no way back except the sidebar). It now has "Back to My Team".
- **Avatar initials were 4.31:1** (brand blue on pale blue). The new roster and member avatars use `text-brand-600` (5.80:1). The existing account-menu avatar is the same 4.31:1 and stays in the backlog.

## Harness findings (the test database, not the feature)

- The first browser run of the decision step failed with `ECONNRESET` **inside the decision route handler**. The test database accepts one connection at a time, and the route handler's pool could not
  connect while the pages' pool held it. With a shorter idle time in the throwaway copy only (`idle_timeout` 1, pool 1) the same flow worked end to end. The decision route is untouched by this work.
  This suggests route handlers can have their own pool as well (the earlier instrumented count only proved that `/api/health` has one). **Not measured for the decision route**, so treat it as evidence, not proof.

## Not verified

- Anything on Vercel, and a real Supabase sign-in (the browser used the mock login and an in-memory database).
- Screen readers: the markup (labelled fieldsets, table headers, `sr-only` words) is tested, not heard.
- That the browser decisions wrote their audit rows (the route and `decide.ts` are untouched and have their own tests).
- The HR Admin's **member** page in the browser (only the HR roster was; the HR-to-manager case is in the real-engine tests).
- On staging no decided request has a stored reason, so the privacy check there is vacuous; the real-engine tests and the browser cover it.

## Backlog

- **Policy:** HR or the supervisor must confirm that managers may see a report's balances (the PRD roles line says so, flagged). The balances are isolated, so removing them is small.
- **Not-found is HTTP 200**, not 404, because the app shell streams before the page decides. What the requirement needs holds (identical outcome for every reason), but a monitor that counts 404s will not see these.
- The roster is not paginated and has no search or sort (fine for a team of tens; revisit for a manager with many reports).
- "Last request" means the most recently **submitted** one, not the latest decided.
- Reads of another person's history are not audit-logged (an existing backlog item, agreed to keep).
- A manager sees their direct reports only, one level (no manager of managers). HR Admins see the managers they manage.
- The new `nav-user.svg` is hand-drawn in the style of `nav-users.svg`; the account-menu avatar contrast (4.31:1) is unchanged.
- The labels "Reason:" and "Rejection note:", and the exact error wording on the member page, are my choices, not from the mockup.
- `/favicon.ico` 404 and the HR override for over-balance requests (existing). `knowledge/HANDOFF.md` is stale and does not cover today's work.

## Follow-up (user feedback after validation): the filter card from the mockup, and no full reload on Apply

- **Symptom:** applying a filter reloaded the whole page. **Cause:** the filters were a plain GET form, which makes the browser load a new document.
- **Fix:** a client `FilterShell` (`useTransition` and `router.push(..., { scroll: false })`) applies filters, removes a chip or clears all by client navigation; a `ResultsRegion` dims the
  old results and sets `aria-busy` (with a polite "Updating requests" status) until the new ones arrive. The form stays a plain GET form (it still works without JavaScript) and the address still
  changes, so reload, back and bookmarks keep the view. The server still validates every value. The form is keyed by the applied filters so the selects always show what is applied.
- **Redesign (from the new mockup):** a "Filters" card with three selects (leave type, status, year) with leading icons (`calendar-days`, a new neutral `clock.svg`, `calendar-days`) and the design's chevron,
  "Apply filters" and "Clear filters" on one row on desktop and stacked full-width on phones, a divider, and a chip per applied filter ("Leave type: Vacation", "Status: Pending", and "Year: 2025"
  when it is not this year) with a × that removes just that filter, plus "Clear all". The result count is now the heading above the table ("31 requests"). The segmented radio buttons are gone.
- **Verified in a real browser** (production build in a throwaway copy): after Apply the page flag, the load timestamp and the header, balance and filter-card elements all survived, **0 full-document
  requests**, the results, address and chips updated, and the dimmed busy state was observed; removing a chip, Clear all and the back button (which also restored the selects) behaved the same
  way; with scripts disabled the plain form still filtered. Screenshots at 1440 and 375 px match the mockup. Tests: 147 pass in the team, budget and skeleton folders; the new address helpers
  (`filtersHref`, `filterChips`) and the shell have their own tests.
- **Notes:** the first run of my browser check read the page too early because of an operator-precedence bug in my own wait condition (`x ?? 0 === 2`); I fixed the script and reran, so the numbers above are from the clean run.
  A new asset, `public/icons/clock.svg`, was added in the style of the existing icons. Not verified: screen-reader output for the busy status and the chips.

## Addendum: My team became a tab of Team Approvals

- Routes moved to `/approvals/team` and `/approvals/team/[userId]` so the sidebar's single Team Approvals item stays highlighted by its existing prefix match; no `app-frame` change was needed. `/team` no longer exists (404).
- Route-based tabs are links in a labelled `<nav>` with `aria-current="page"`, not `role="tablist"`. They add no statement, so the query budget is unchanged (approvals = 2, roster = 1, member = 1).
- The approvals page used `max-w-5xl`, which is why it stopped short of the right edge; removing it made it fill 100% of the usable width at 320 to 1920 px, identical to the dashboard.
- The pending queue and Recently decided now stream as two sections with their own failure notes (the page used to send a read failure to the error page).
- Harness note: after Approve/Reject, `router.refresh()` against the one-connection pglite shows the failure notes (ECONNRESET from two pools). It is the known harness quirk; a reload shows the right state.
- Not done (needs a decision): link the employee name to the member page (needs the user id in `getTeamQueue`/`getRecentlyDecided`), and the Audit page's `max-w-5xl`.
