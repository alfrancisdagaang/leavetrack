# Retro: the manager split, EPIC-12 (TASK-067 to 069)

Built and validated locally, **not committed, not pushed** (the user commits). Not in the PRD (docs rule); the tasks are in `docs/dev-tasks/epic-12-manager-split-tasks.csv` (status `Built`). No query, migration, role or required-feature change.

## What shipped

| Task | What                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 067  | A manager-only **My Team** nav item (`/approvals/team`, white `nav-team.svg`); `TeamTabs` and its test removed; titles "Team Approvals" and "My Team". URLs unchanged, so no redirects: `currentNavItem` already picks the longest matching href.                                                                                                                                                    |
| 068  | **Team Approvals** in the Balance Overrides style: a card per section (icon, title, "N pending" / "N recent" chip), rows with four columns and dividers from `lg`, dates as "Nov 2 to Nov 6, 2026", a note strip ("Approving uses 3 days from their Vacation balance of 10 days." or the over-balance text). Shared row pieces moved to `approvals/row-layout.tsx` (also used by Balance Overrides). |
| 069  | **My Team** as a wrapping grid of cards (`roster-grid.ts`: cells grow, so the last row always fills the width). A card links to `/approvals/team?member=<id>`, which opens a modal `<dialog>` (`member-dialog.tsx`, the only client piece, copied from the calendar's day dialog) with the person's balances, filters and requests (`member-popup.tsx`, the same read as the member page).           |

## Decisions taken (defaults, no objection)

1. Popup (not a link to the member page); URLs kept; the old `/approvals/team/[userId]` page kept as is; an EPIC-12 CSV added.
2. In-balance rows got a note strip ("Approving uses N days from their X balance of M days."). It was not in the plan; it is easy to drop.
3. The popup's addresses carry `member=<id>` (`memberHref(..., popup)`, `filtersHref`, `filterChips`); the filters form posts to `/approvals/team` with a hidden `member` field, so it also works without JavaScript.
4. Another team's id, a missing or deleted person, the manager themself and a malformed id all show one message in the popup. The malformed id never reaches the database.

## Validation

- **Gate (exit codes read):** lint 0, prettier 0, tsc 0, `npm test` 0 (**1,037 passed, 164 skipped**, gated), build 0 on a throwaway copy of the final code (with `.env.local` removed from the copy).
- **Unit tests added or changed:** nav (three manager items, My Team current under `/approvals/team/*`, distinct icon), app-frame, both pages (no tabs), rows (month-name dates, in-balance note, Reject only for over-balance, no-record and negative), sections, skeletons, roster card and grid (cells grow; link goes to `?member=`), member-url popup addresses, filters in popup mode, dialog, popup (found, not found for malformed/foreign/missing all the same, failed read keeps the person in the retry link, every link keeps `?member=`), and the query budget (My Team 1 statement; with a member open 2).
- **Browser check** (headless Chrome, production build of the final code, seeded PostgreSQL 18.4, mock cookie, one context per role): **125 checks, 0 failed** at 1440, 768, 375 and 320 px. Manager: two nav items, the right one current on each page, no tabs, dates with month names and no ISO dates in the main area, three pending rows (normal: Approve and Reject; over-balance: Reject only), four columns from `lg`, no row overflows, no sideways scroll; My Team shows own reports only, cards fill every row, the popup is modal and inside the screen (centred card from `sm`, bottom sheet on phones), page behind locked, a filter keeps the popup open, Escape, backdrop click and the Close link all return to My Team; another team's id (Leo), a missing id and a malformed id show identical text and no name; an 80-character unbroken reason causes no sideways scroll in the page or the popup; Approve inside the popup keeps it open and shows Approved. Employee and HR Admin are sent to the dashboard (also with `?member=`) and have no manager nav. Balance Overrides still has four columns. Screenshots at 1440 and 375 px were looked at.
- **Not run:** the gated real-database tests (no query or schema changed; both reads are the existing, already gated ones), a mutation proof (no new SQL rule), GitHub Actions and Vercel (nothing pushed), the real sign-in path (mock cookie only: Marco, Hana, Elena), a screen reader, another team's manager in a browser (the mock has no such login; the not-found path is covered by tests and by Leo's id).

## Backlog (nothing blocking)

- **The request table inside the popup (and on the member page) still shows ISO dates** ("2026-11-23 to 2026-12-02"). The Team Approvals page was asked to use month names; the member table was not in scope. `formatRange` would fix both; its tests assert the ISO text.
- Two ways to see a member now (the popup and `/approvals/team/[userId]`). Redirecting the old route to the popup, or deleting it, is a later decision.
- `member-dialog.tsx` is a copy of the calendar's `day-dialog.tsx`; one shared dialog would remove the duplicate.
- The popup's Close button shows a focus ring when it opens (the first focusable element), as in the calendar.
- The roster card's last-request badge says "Approved" for an overridden request (older backlog item, `STATUS_BADGE`).
- A card's accessible name replaces its text for screen readers (`aria-label`), so the pending count and balances are not read from the link; the popup has them.
- CSV and HANDOFF bookkeeping for EPIC-12 is not done (only when asked).

## Decision: managers do not see balances (2026-10-19, after validation)

Asked by the user: BR-03 says the employee views their own balance, and the docs never give managers a balance view (the My Team balances were our own addition, US-12 and US-13). UI only: no query, type or API changed; the balance data is still read because the over-balance check and the kept rows need it.

- **Removed:** the balances on My Team cards; the balance cards in the member popup and on `/approvals/team/[userId]` (`member-balances.tsx` deleted); the in-balance note on Team Approvals rows ("Approving uses N days from their X balance of M days."). This reverses decision 2 above.
- **Kept on purpose (the user chose it):** the text on a blocked request: "Over balance by N days" and "the X balance is M days" (Waiting for HR override, Reject only), "No balance record" and "Balance is negative". So a manager sees a balance figure only on a request that cannot be approved, never as a general view. HR's Balance Overrides, the employee's My Balance and the server's over-balance check are unchanged.
- **Tests:** the removed text is now asserted absent (with balances in the test data, to prove it is hidden and not just missing); the kept rows' tests are unchanged.
- **Validated:** gate by exit codes (lint 0, prettier 0, tsc 0, `npm test` 0 with 1,023 passed and 164 skipped, build 0 on a throwaway copy without `.env.local`); the browser check was rerun on a fresh build and a fresh seeded PostgreSQL with the balance assertions flipped: **140 checks, 0 failed** at 1440, 768, 375 and 320 px (no balance figure on any My Team card, none in the popup or on `/approvals/team/<id>`, no note on in-balance rows; "Over balance by 3 days", "the Sick balance is 5 days" and Reject only still there; the employee's My Balance and HR's Balance Overrides still show amounts). Screenshots looked at.
