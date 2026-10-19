# Retro: TASK-055, the notification bell (EPIC-9)

Not committed, not pushed. Builds on TASK-052 to 054 (all uncommitted). Visual design from a ChatGPT mockup the user pasted (no Figma).

## What shipped

- `NotificationBell` (`src/components/ui/notification-bell.tsx`, the only client piece) in the top bar of every signed-in page, between the title and the account menu. A 44 px button named "Notifications, N unread" (the badge is decorative), a number badge ("99+" above 99), and a dropdown: heading, "Mark all as read", rows, and empty, loading and error states with Retry.
- Pure, unit-tested helpers: `notification-text.ts` (the sentence, link, badge, relative time, icon, and a hand-written guard for the two API answers), `notification-state.ts` (a reducer for the optimistic marks and their revert), `notification-panel.tsx` (presentational; `renderToStaticMarkup`-tested).
- Rows: unread is marked by weight, a dot AND the word "New" (plus a hidden "Unread:"), never colour alone. A row links to Team Approvals (manager) or My Balance (employee), `prefetch={false}`. Long names wrap (`break-words`, `min-w-0`).
- Mobile (below `sm`) the panel is `fixed inset-x-4` under the bar, so it can never be anchored off-screen next to the avatar; from `sm` it is `absolute right-0 w-96`.
- Times are by `APP_TIMEZONE` (the layout passes it, default UTC), never the viewer's zone.

## The design decision (the user did not choose; I went with my recommendation, and it deviates from the CSV)

**The bell costs the server nothing while a page renders.** The CSV said to read the count in a streamed Suspense section in the layout. The three dashboards already use 4 of the 4 allowed parallel statements (`POOL_MAX - 1`), so that would have been a fifth, the number that stalled pages in October. Instead the bell calls the TASK-054 route in the browser: once after the page has loaded (idle callback), when the panel opens, and when the tab becomes visible again. **Never on navigation** (it would overlap the next page's own statements) and never by polling. The cost: a new notification shows up on the next of those, not instantly. The CSV row for TASK-055 still describes the Suspense design and is not edited (only when asked).
`query-budget.test.ts` now guards this: the layout and the bell files import nothing that reaches the database, the bell is `"use client"` and reads through the two routes, and no effect depends on the pathname.

## Validation

- Unit and component tests: 963 passed, 138 skipped (gated). Lint, format, typecheck clean; `npm run build` passed in a throwaway copy.
- **Real browser** (headless Chrome, a throwaway production build on a seeded PostgreSQL 18.4, mock-role cookies, one browser context per role): **199 checks, 0 failed.** Employee, manager and HR at 1440, 375 and 320 px: the bell's name and badge equal the API's count; 44 px target; the panel opens inside the viewport with no sideways scroll (page or panel), lists what the API lists, one "New" per unread row, rows at least 44 px, no reason or note in the text; the long unbroken name wraps; the removed request is noted; the HR panel is the empty state; Escape closes and returns focus to the bell; an outside click closes; keyboard only (Enter opens, Tab reaches "Mark all as read", Escape returns); a forced 500 shows the bell without a count and an alert with Retry while the page still renders, and Retry restores the count; no console error or CSP violation. Then a row click navigates (Team Approvals, My Balance) and marks exactly one row on the server with the badge following; Mark all clears the badge and the server count; the button then disables.
- Screenshots of the manager at 1440 and 375, the HR empty state and the error state were compared with the mockup: same layout, badge, row structure and wording.
- Guard mutation proofs: adding a `requireDb` import to the layout fails the budget guard; making a read depend on the pathname fails it too.

## Found

- **A real bug in my first version, caught by the browser check:** opening the panel starts a read; if "Mark all as read" was clicked before it returned, the stale answer overwrote the optimistic mark and the badge came back. The old "newer read wins" ticket only covered reads. Fix: a mark invalidates every older read, and reads once more after the POST settles so the list matches the server. Proven by a deterministic test that serves the browser a response fetched before the click and delivered 900 ms later: it fails 3 checks without the fix and passes with it (first attempt delayed the request instead of the response, so the answer was already fresh and the test proved nothing; fixed).
- My script's first expectation for HR was wrong: with nothing to read, "Mark all as read" is disabled and unfocusable, so Tab correctly moves on.
- Backlog: a date range can break after the dash at 375 px ("Feb 1–" then "26"); cosmetic. The panel shows the last 20 only (no "see all"); the count can exceed the rows shown, as designed.

## Not seen

GitHub Actions for TASK-052 to 055, Vercel, staging, and real sign-in (every browser check used the mock cookie). The bell's first fetch needs a real Supabase session cookie on the API routes; `proxy.ts` and `getSession()` serve the routes the same way as every other `/api` call, but I did not exercise it.

## Open

- The CSV rows for TASK-052 to 055 and the handoff are not updated; the TASK-055 CSV text should be changed to describe the client read (only when asked).
- TASK-056 (optional email copies) and TASK-057 (end to end and validation) remain.
