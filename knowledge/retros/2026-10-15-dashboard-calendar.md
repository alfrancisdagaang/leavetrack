# Retro — dashboard leave calendar (2026-10-15)

Scope: TASK-030 / US-10 (new). A month calendar on the dashboard from the Figma frames 14:8878 (desktop) and 14:9401
(mobile): multi-day bars over the dates, blue Vacation / green Sick / purple Unpaid, solid approved and striped pending,
Previous / Today / Next, a legend and a "Show rejected and cancelled" switch. Scope is in SQL by role (employee: own;
manager: own plus direct reports; HR: everyone). Not in this slice: links to a request detail page, an HR employee filter,
a "+N more" cap, upcoming leave and recent activity.

## Acceptance criteria (US-10)

| AC                                                                                          | Proof                                                                                                                                                                           | Result |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1 employee sees only their own spans, coloured by type, approved solid, pending striped   | `calendar.test.ts` (SQL is `r.user_id = ?` only), real-DB test, Chrome: Elena sees only Elena's bars                                                                            | PASS   |
| AC2 manager sees own plus direct reports; another team never appears                        | `calendar.test.ts` (`u.manager_id = ?`), real-DB test (Marco: Elena, Jun, self, never Leo or Priya; Priya sees Leo only), Chrome: Marco sees Marco, Elena, Jun; never Leo/Priya | PASS   |
| AC3 HR sees everyone                                                                        | real-DB test, Chrome: Hana sees all five demo users                                                                                                                             | PASS   |
| AC4 rejected hidden unless the switch is on                                                 | real-DB test, component test, Chrome: hidden by default for all roles; switch sets `?rejected=1`, Elena's rejected bar appears, month navigation keeps it                       | PASS   |
| AC5 previous, next, Today change the month; today is highlighted                            | layout tests, Chrome: Next to November, Previous twice to September (leading cells show 1-3 Oct), Today returns and drops `?month`; only 15 Oct highlighted                     | PASS   |
| AC6 usable at 375 and 320px without horizontal scroll; every request also available as text | Chrome: no overflow in 18 role/width combinations (320 to 1440); owners box on mobile; screen-reader list with one entry per request                                            | PASS   |

## Verification

- `lint`, `format:check`, `typecheck`, `npm test` pass (262 passed, 10 skipped = the gated real-database tests).
- Gated real-database tests (calendar scope and range, plus the TASK-018 ones) run on a throwaway PG 18 database: 10 of 10 pass.
  The database was dropped afterwards; the user's `leavetrack` database was not touched.
- Headless Chrome (CDP) against `next dev` on port 3001, pointed at that throwaway database with demo requests and
  `APP_TIMEZONE=Asia/Manila`; stopped afterwards. Screenshots reviewed against Figma by eye: manager at 1280, 375 and 320, the
  rejected view, HR at 1024.
- Contrast (computed): white on Vacation 4.93, Sick 6.77, Unpaid 7.17; ink on the pending stripes 9.6 to 9.9; muted text on the
  rejected fill 4.63; dates 13.5; switch track 5.34 (non-text, needs 3).
- `npm run build` was **not** run: the user's `next start` is listening on port 3000.
- Not verified: real touch devices, pixel comparison with Figma, how HR's view behaves with hundreds of overlapping requests.

## Issues found and fixed

| Severity | Issue                                                                                                                                 | Fix                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| FIX NOW  | The gated test inserted a rejected request without a note; the DB rejects it (`leave_requests_rejection_note`). My test, not the app. | The test now sets a decision note for rejected rows.                                                            |
| FIX NOW  | The component trusted the data layer to leave rejected requests out; a unit test caught it showing them with the switch off.          | The calendar also filters rejected requests unless the switch is on (defence in depth).                         |
| FIX NOW  | At 320px the short status labels on single-day bars were cut ("Ap...", "Pe...").                                                      | Calendar card padding `p-4` and bar padding `px-0.5` below `sm`; re-measured: nothing clipped at 320, 360, 375. |
| FIX NOW  | Type error: `Set<uuid-template>.has(string)` in the gated test.                                                                       | `new Set<string>(...)`.                                                                                         |

Two Chrome-script mistakes (not app bugs) were also corrected: React writes the inline grid style differently on the server and
after client navigation, so the script now reads computed grid columns; and the switch-on URL correctly keeps `month=`.

## Deliberate choices and differences from Figma

- Bars have no link or arrow until the request detail page exists; each bar has a hover title, and every request is listed as
  text for screen readers (the bars are `aria-hidden`).
- Pending stripes are CSS (a repeating gradient from the leave colour), because the Figma stripe is an SVG sized to one bar.
- Rejected bars have no design: muted fill, dashed outline in the type colour, the word "Rejected".
- "Today" follows the optional `APP_TIMEZONE` (default UTC); set it on Vercel (for example `Asia/Manila`).
- Bars are painted across calendar dates as entered, including weekends inside a span.

## Backlog

- [ ] **Bars link to the request detail page** (and drop the hover title) once `/requests/[id]` exists; bars become interactive
      and need keyboard focus then.
- [ ] **HR at scale:** no employee filter and no "+N more" cap, so a busy month makes tall rows; and no date-range index
      (`leave_requests` has only `(user_id, status)` where not deleted). Add both when HR's view slows down.
- [ ] **Cancelled** requests: the switch says "rejected and cancelled" but only rejected exists; include soft-deleted rows when
      cancel ships.
- [ ] **Single-day bars in one narrow column** truncate the label at 1024px ("Test · Vacati..."); the hover title and the text list
      carry the full text.
- [ ] **Upcoming leave and Recent activity** (the rest of the dashboard design) are not built.
- [ ] **Staging demo data:** the seed has only three pending November requests, so the staging calendar is nearly empty until
      demo requests (approved, rejected, multi-week) are added. Offered, not done.
- [ ] The toggle URL always includes `month=` even for the current month (cosmetic).
- [ ] No committed browser tests; the Chrome checks are a throwaway script (same gap as the sidebar retro).
