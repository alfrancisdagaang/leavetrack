# Retro: EPIC-7, the HR calendar (TASK-042 to 044)

Built, validated locally, **not committed** (the user commits). Not in the PRD (docs rule); the acceptance criteria live in `docs/dev-tasks/epic-7-hr-calendar-tasks.csv`. The CSV rows and header are not updated (only when asked).

## What shipped

| Task | What                                                                                                                                                                                           |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 042  | `src/lib/leave/hr-calendar.ts`: `getMonthCounts`, `getDayPeople`, `getHrCalendarChoices`, one statement each. `parseHrCalendarQuery` in `schemas.ts`. Pure helpers in `hr-calendar-layout.ts`. |
| 043  | `/calendar` (HR only): `src/app/(app)/calendar/*`, a Calendar nav item for HR Admin only, a budget guard in `query-budget.test.ts`. Design from the user's ChatGPT mockup (no Figma).          |
| 044  | Load check at 800 users, then about 8,000 and about 21,600 requests; browser check at 1440, 375 and 320 px; full gate.                                                                         |

## Decisions taken (defaults, no objection yet)

1. **"N out" counts distinct people** with an approved or pending request that day; "N pending" is the people with a pending request. A person with two overlapping requests counts once in the day's total (grouping sets in SQL). The per-type figures count people of that type, approved and pending together.
2. **The day list is by request**, so that person can appear twice. The panel heading uses the grid's people figure and the list says how many requests it shows (found in the browser check: the heading first said 42 people against 35 in the grid).
3. **Team = a person with at least one direct report** (`users.manager_id`); filtered by `team=<manager id>`. HR Admins appear only if somebody reports to them.
4. **Filters are a plain GET form** (works without JavaScript) and the page has no client component. A filter change closes the open day. Month, team, type, day, name search and page are all in the address; a bad value is ignored and named in a notice.
5. **The month is full width and the open day is a popup** (user feedback after the first build, which had a side column that left dead space): a native modal `<dialog>` (`day-dialog.tsx`, the only client piece), centred from `sm` and a bottom sheet below it. The browser traps focus and makes the page behind inert; Escape, a click on the backdrop and the Close link return to the month with the same filters. It is rendered open by the server, so the day also shows without JavaScript (without the backdrop and focus trap). The month name and arrows are centred, Today sits to the side from `sm` and below on phones, and the filters are one row from `lg`. The mockup's "25 per page" selector and department line were left out (fixed page size; no department data exists).
6. **No index and no migration.** EXPLAIN showed none was needed (below).
7. HR's scope is everyone, a documented exception to AGENTS.md rule 3 (like the audit list and the override route). The scope is the role, and it is in the SQL (TASK-042 AC4, found by `/validate`): every read takes the signed-in user's id from the server session and returns nothing unless that user is an `hr_admin`. `requireRole` on the page is the first gate. The team and type are filters, never an identity.

## Polish from the second reference image (2026-10-19)

Presentation only; no query, type or migration change. One row from `lg`: Month (label, prev, the month in a box, next, Today), Team, Leave type, Apply; Today is always shown (it carries `aria-current` on the current month). The month is no longer centred (the user's earlier request is superseded by the image). Every day lists every leave type in the design's order (Vacation, Sick, Unpaid; any other after, by name; one type when the filter picks one), zeros included, and "0 pending" on a day somebody is out. The popup has a neutral icon Close, four summary tiles (the three types with the dashboard's icons and tints, and Pending), a search box with a magnifier and, from `sm`, a header row over the list. Phone rows have a chevron. Left out on purpose: the "25 per page" selector (fixed size), department lines (no data), and a collapsible Filters row on phones (two selects cost about 130 px and a collapsible row needs a client component).

## Validation

- **Real PostgreSQL 18.4** (embedded, gated file `hr-calendar.integration.test.ts`, 11 tests): exact counts split by type and status, one person with two requests, team and type filters, the whole company (including a person without a manager), a request spanning February and March, weekends never counted (also a weekend-only request), rejected and soft-deleted never counted or listed, a weekend day lists nobody, paging 25 / 6 and a page past the end, a literal `%` in the name search, one statement per read, no reason in any result, no writes.
- **16 mutations, each fails at least one test (12 on the rules below, 4 on the role check: removed from the month, the day and the choices reads, and weakened to any user):** month without the team filter, without the type filter, with deleted requests, with rejected requests, with weekends, `count(*)` instead of distinct people; day without the weekend guard, without the team filter, with rejected, with deleted, with a wildcard search, without the page clamp. The source was restored and compared with the saved copy afterwards.
- **Unit and page tests:** layout helpers, the address parser, the address builder, the nav (HR only, icon), the page (role gate, invalid values), the body (month figures as text, filters passed to the read, the open day, empty month with and without filters, failed read in an alert with a retry link, a day is a link only when somebody is out), and the **query budget** (three parallel statements with a day open, two without; the guard still fails for six).
- **Browser check** (headless Chrome, a production build of the working tree, mock `mock-role` cookie, one context per role, seeded PostgreSQL with 101 users and 605 requests so 35 people are out on the busiest day): **191 checks, 0 failed** at 1440, 768, 375 and 320 px (after the popup and the polish; 126 before the polish, 96 before the popup): manager, employee and signed-out are sent away; no sideways scroll for the month, an open day, filters, an empty month and a 64-character unbroken name; five weekday columns from `sm`, a list of busy days below; counts, pending and "Today" and "Open" written as text; paging; name search; team and type filters kept across months; Today link; keyboard reaches a day link, it has an outline and Enter opens it; the day is a modal dialog that fits the screen, is centred on desktop and a bottom sheet on phones, holds focus, locks the page behind it, and closes on Escape, on a backdrop click and on the Close link; the month fills the card width and its title is centred; controls at least 40 px tall on phones; a server with a wrong database password shows the failure alert with Retry.
- **Gate on the working tree:** lint, format and typecheck clean; **989 tests passed, 158 skipped** (gated); build passed on a throwaway copy of the working tree.

## Load check (throwaway database, never staging)

800 users (40 managers), `generate_series` data, PostgreSQL 18.4 on the Mac (no network), 10 timed runs after a warm-up:

| Read                           | 8,000 requests | about 21,600 requests |
| ------------------------------ | -------------- | --------------------- |
| Month, whole company           | 2.1 ms median  | 3.0 ms                |
| Month, one team                | 0.8 ms         | 1.4 ms                |
| Month, team and type           | 0.7 ms         | 1.3 ms                |
| Day, whole company, page 1     | 0.9 ms         | 1.4 ms                |
| Day, page 2 with a name search | 0.9 ms         | 1.4 ms                |
| Choices (types and managers)   | 0.2 ms         | 0.2 ms                |

The page's query deadline is 3 s for a first attempt, so every read is far inside it (against a local database; on Supabase add the network, about 0.7 s per new connection from the Mac).

**One fix from the plan:** the first plan joined every live request to every day (6 ms at 8,000 rows, reading 6,803 rows). A month-overlap predicate on the request (`start_date <= month end and end_date >= month start`) cut that to 700 rows and 2.1 ms. Both plans seq-scan `leave_requests`; at this size an index is not needed, and one on `(start_date, end_date)` would not change a seq scan of a table this small. The predicate is a speed filter only (the day series already bounds the result), so no test can fail without it; the timing is its proof.

## Not seen

- **GitHub Actions, Vercel and staging** (nothing is committed or pushed).
- **The real sign-in path** (every check used the mock cookie, which maps to Hana as HR only). Leo (another team) was never in this feature's tests: the gated test uses its own teams, and the team filter, not a team scope, is what narrows the data (HR sees everyone by design).
- **A screen reader.** Names, roles and live regions are in the markup; spoken output was not checked.
- Real Supabase latency for the new reads.

## Open

- CSV rows for TASK-042 to 044, the EPIC-7 header, and `knowledge/HANDOFF.md` are not updated (only when asked).
- The gated tests do not run in CI (no `TEST_DATABASE_URL`).
- Backlog: the search and close icons are drawn inline in `day-panel.tsx` (no shared icon file yet); the Today button on the current month links to the same page; a team filter lists managers only (no sub-teams); the popup's Close button shows a focus ring when it opens (the browser's first focusable element); "Totals count pending requests" is a note, not a toggle.

## How to re-run

`knowledge/patterns/implement-and-test.md`: `embedded-postgres` in the scratchpad, the migrations applied, `TEST_DATABASE_URL` set; for the browser check `puppeteer-core`, `next start` of a throwaway copy with `ALLOW_MOCK_LOGIN=true`, a second server with a wrong database password for the failure state, and `generate_series` for the load data.

## Dashboard rework for HR and manager (2026-10-19)

Asked for by the user after the Company Calendar shipped: the HR dashboard calendar (one bar per person) was redundant, and the HR and manager summary rows (one card each in a three-column grid) left dead space.

- **HR:** the dashboard calendar is removed for `hr_admin` only (the user confirmed; employees and managers keep theirs). The row is Awaiting HR override, **Out today** and **Pending requests** (every pending request, company-wide; it includes the over-balance ones counted in the first card, and the card says so), with a **Next 7 days** strip under it: the next weekdays with "N out" and "N pending" as text; a day with people is a link that opens that day in the Company Calendar popup.
- **Manager:** keeps the team calendar. The row is Pending approvals, **Out today** (my team) and **Out in the next 7 days** (my team, people counted once).
- **Weekend:** Out today says **Weekend**, with no number, on a Saturday or Sunday (nobody is counted then).
- **One read, `getOutFigures`** (`src/lib/leave/out-figures.ts`): ONE statement for today through today + 6, scope chosen in the SQL from the signed-in user's own role (`company` answers only for an `hr_admin`, `team` only for a `manager` and only for their `manager_id` reports; anyone else, or an unknown id, gets nothing). The manager's pending-approvals figure comes from the same statement, so a manager dashboard replaced its balance summary read with it and stays at **4** parallel statements; HR is override count + out figures + upcoming + activity = **4** (the calendar read is gone). Both are asserted in `query-budget.test.ts`.
- **Grid:** below `xl` the summary row has two columns, so an odd last card now takes the whole row (`cardsGridClass`, shared with the skeleton). This also fixes the employee's three cards at 375 and 768 px.
- **Validation:** gated real-database test (5 tests, PostgreSQL 18.4; company and team scopes, another team, role gate for every wrong pairing, weekends, a person counted once, rejected and soft-deleted never counted, one statement, no writes) with 10 mutations: 9 caught, and the window-start mutant is equivalent (that predicate only narrows rows the day join already excludes), so it stays unproven by a test, like the month-overlap predicate of the calendar read. The first run also missed a soft-deleted pending request in the pending total; the test data now has one, and the mutation is caught. Browser check (headless Chrome, production build, one context per role) at 1440, 768, 375 and 320 px: **87 checks, 0 failed** (three cards in the right order, every card row fills the width at every size, three cards on one row at 1440, no sideways scroll, HR has no calendar and has the strip, a strip day opens that day in the popup, managers and employees keep their calendar, Upcoming leave and Recent activity stay).
- **Backlog:** the HR "Pending requests" figure counts requests that managers can still decide, so the number can look large (99 in the seeded browser data); a second line splitting "with managers" from "waiting for HR" would be clearer if HR asks.

## Balance Overrides page polish and rename (2026-10-19)

From the user's third ChatGPT reference. The nav item and page are now **Balance Overrides** (chosen by the user from five options: it says what is overridden and keeps the PRD's word "override"; `HR Overrides` before). The address `/approvals/overrides`, the audit badge "Approved (HR override)", the dashboard card "Awaiting HR override" and every route are unchanged. Renamed in the nav label, the page heading and tab title, the two user-facing error messages that point to the page (`roles.ts`, `decide.ts`), the tests, and the demo checklist; `HANDOFF.md` and older retros keep the old name as history.

- **Layout:** each section is one white card (round icon, title, count chip: "3 pending", "1 recent"); each request is a row inside it with four columns and thin dividers from `lg` (they stack below it, without dividers), a calendar icon on the dates and a person icon on the working days, a bold "Over balance by N days", and the effect of approving in a light strip with a note icon. Recently overridden uses the same row without actions. Dates read "Nov 2 to Nov 6, 2026" (the Audit page's format) because the ISO dates broke mid-date ("2026-11-" then "06") in the narrow column. New files are inside the overrides folder only (`override-card.tsx`, `override-icons.tsx`, `override-skeleton.tsx`); the shared approval row pieces are untouched, so the manager's Team Approvals page did not change.
- **Left out on purpose:** the reference's ">" on each row and the "…" menu on the recent rows (no request detail page and no row menu exist, so they would be dead controls).
- **Browser check** (production build, one context per role, seeded over-balance requests including a 70-character unbroken word): **60 checks, 0 failed** at 1440, 768, 375 and 320 px: manager and employee are sent away and never see the name; the card heading and chip; four columns with dividers at 1440 and none below `lg`; the effect strip; Approve override and Reject; approving one moves it to Recently overridden with "N recent" and the green badge; Reject asks for a reason; no row overflows; no sideways scroll; the nav item is current.
- **Known:** at 320 px the top bar title "Balance Overrides" is cut off with an ellipsis (88 px wide); it fits at 375 px after the title got `text-base` below `sm`. If that matters, a shorter top-bar-only label ("Overrides") is the fix.
