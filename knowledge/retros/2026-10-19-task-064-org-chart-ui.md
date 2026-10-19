# Retro: TASK-064, the Organization tab (EPIC-11)

Built and validated locally, **not committed, not pushed**. UI only on top of the TASK-063 reads: no migration, no new route, no role or required-feature change; nothing under `docs/` touched. The "not available yet" placeholder is gone from this tab (Account settings is still a placeholder until TASK-065).

## What shipped

- `/profile/organization` picks the read from the SESSION role (`org-section.tsx`): employee `getEmployeeOrg` (1 statement), manager `getManagerOrg` (1), HR `getOrgRoots` plus `getEmployeeOrg` for HR's own manager (2, in parallel). A failed read is an alert with a "Try again" link and the header and tabs keep working.
- **Employee:** manager above, themself highlighted ("You" in text plus `aria-current`), a connector, direct reports or "No direct reports", a "Reporting line" legend, and a "Your manager" side card.
- **Manager:** their manager above, themselves, and a tree of native `<details>` (no client code), all closed at first; each person says how many report to them; indentation stops after level 3; "Showing N of M people under you" when the read was cut; a person whose reports were not loaded says "N reports not shown".
- **HR:** the roots, each with a labelled expand button (`aria-expanded`, `aria-controls`); opening reads `GET /api/org/children` 50 at a time with a per-person busy and error state and Retry, focus kept on the toggle, focus moved to the first new person after "Show more", people shown once each, a late answer for an older request ignored (`org-hr-state.ts`, a pure reducer). Roots past the first 50 are only noted ("Showing 50 of N"): the route pages a person's reports, not the roots.
- Nothing links to a person; only id, name, role and report count are drawn (a test feeds the section objects with an `email` and a `reason` and asserts neither is rendered).

## Validation

- **Gate (exit codes read):** lint 0, prettier 0, tsc 0, `npm test` 0 (**1,166 passed, 180 skipped**, gated), build 0 on a copy of the final code without `.env.local` (`diff -rq` against `src` clean).
- **Unit tests:** the pure modules (text, tree builder, response parser with 13 invalid shapes, reducer with 10 transitions), the section for all three roles, the HR tree's first render and two source guards, the page, and the query budget (employee 1, manager 1, HR 2).
- **Mutation proofs (12 of 12 caught, files restored and `cmp`'d):** stale answer and stale failure not ignored, no dedupe, collapse losing data, `hasMore` off by one page, the first page stealing focus, indent never capped, hidden count wrong, orphans attached to the top, manager tree starting open, `aria-expanded` removed, HR reading the roots as someone else.
- **Browser** (headless Chrome, production build, seeded PostgreSQL 18, mock cookie, one context per role, plus a 7-level chain under Marco with a 140-character unbroken name and 55 reports under Priya): **243 checks at 1440, 768, 375 and 320 px, 0 failed.** Employee: right people only (never Jun, Leo, Priya, Hana or Sam), one `aria-current`, "You" as text, no links to people, no email. Manager: five closed `details`, Enter opens and Space closes, summary at least 44 px, all open down to depth 6 ("1 report not shown", depth 7 absent). HR: Sam by keyboard, focus stays on the toggle, Hana marked "You", Priya's first page is 50 with "Show 5 more", focus lands on the first new person, collapse and reopen make no new request, a forced 500 and an aborted request each show the alert, Retry works. No sideways scroll anywhere; no console errors. The HR route gives employee and manager 403 and a visitor without a session is sent to `/login`. With the database stopped each role gets the alert and the header and three tabs stay. Screenshots looked at.
- **Not run:** a browser proof of the stale-answer guard (a second request for the same person cannot start while one is running, so the guard is belt and braces, covered by the reducer tests), GitHub Actions, Vercel, real Supabase latency, the real sign-in path, a screen reader.

## Found and fixed during validation

- **[FIX NOW] A fully open six-level tree with a long unbroken name scrolled sideways at 768, 375 and 320 px** (not at 1440). Cause: below `lg` the chart is a plain `grid` with an auto column, and a grid item is as wide as its longest word (the card was 1,343 px). Fix: `grid-cols-1` (`minmax(0, 1fr)`) on all three chart wrappers and the skeleton, asserted in a unit test for every role.
- **[FIX NOW, caught in apply] Components defined inside the HR tree component** remount the whole tree on every state change and drop focus from the button in use. They are plain render functions now; a source test fails if a `List` or `Row` component comes back.

## Decisions taken (defaults, no objection)

1. Roots past 50 get a note, not a pager (no route change). 2. HR reads its own manager (2 statements). 3. Native `<details>` for the manager tree (no `aria-expanded` attribute; the browser exposes the state).

## Backlog (nothing blocking)

- Roots beyond 50 cannot be reached by HR (the route needs a `parent`); moot with one root.
- The chart is read once per page load; the HR tree does not refresh an opened person if the data changes.
- The HR expand button is icon-only with a screen-reader label; a visible "N reports" caption would help sighted users find it (the card already says "N direct reports").
- No browser proof of the stale-answer guard (see above).

## Redesign from the reference mockup, and My Profile in the sidebar (same day, after validation)

Asked by the user: restyle the Organization tab like a reference image and add Profile to the navigation. Built and checked locally, **not committed**. No query, migration, route or role change; the reads, the HR route and their tests are untouched.

**Taken from the reference:** a summary card at the top (large avatar, name, a "You" pill, role, and the viewer's own email and manager, with a divider), then one chart card with a title and a line of help ("See who you report to and who reports to you."), the chart in a centred column (manager card, connector, a blue-bordered "You" card, connector, "Direct reports" with a dashed empty box and an icon: "No direct reports / Team members reporting to you will appear here."), a bordered "Reporting line" key at the bottom left, and "Your manager" in a bordered box at the right from `lg`. Cards are compact with a light shadow; the active tab is brand blue. Trees (manager, HR) use a wider centred column than an employee's chart.

**Left out on purpose** (each conflicts with a decision already taken for this epic): job title and department (the `users` table has neither), "View profile" (no profile pages for other people), the Appearance card and Light/Dark/System (the UI is light-only), the reference's breadcrumb top bar and its sample sidebar items (ours are role-based). The Security card belongs to the Account settings tab (TASK-065).

**Email is on the page now, deliberately and narrowly:** the summary shows the VIEWER'S OWN email, taken from the session user, and their own manager's name from the chart read. No statement was added (employee 1, manager 1, HR 2, asserted in the budget test), and the summary stays up above the alert if the chart cannot be read. The chart still carries no email: a test feeds the section reads that contain other emails and a `reason` and asserts none is rendered, and that the only `@` on the page is the viewer's. If the summary should not repeat the Overview tab's email, drop `ProfileSummary` from `org-section.tsx`.

**Sidebar:** a "My Profile" item (`/profile`, a new white person-in-a-circle icon `nav-profile.svg`) is the last item for all three roles; it is highlighted on `/profile` and its sub-pages (longest-href rule, so no special case) and titles the top bar. The account menu's Profile link stays. Nav, icon and frame tests were updated (each role's list and labels, the icon file, highlight on every profile page, exactly one `aria-current`).

**Validation:** gate by exit codes (lint 0, prettier 0, tsc 0, `npm test` 0 with **1,174 passed, 180 skipped**), build 0 on a copy of the final code (`diff -rq src` clean). Browser (production build, seeded PostgreSQL, one context per role, the 7-level chain with a 140-character name and 55 reports under Priya): **275 checks at 1440, 768, 375 and 320 px, 0 failed**, including the summary card per role, the empty box, "My Profile" last and highlighted in the sidebar, nothing the app does not have, the only email being the viewer's own, no sideways scroll with everything open, and all the earlier HR flows (focus, Show more, error and Retry). Screenshots at 1440 and 375 looked at.

- **Not run:** GitHub Actions, Vercel, the real sign-in path, a screen reader; the mutation script was not re-run (no logic changed, only markup and classes).
- **Backlog:** `knowledge/runbooks/demo-checklist.md` still lists the sidebar items per role without My Profile (docs of the demo, not edited); the Overview tab and the new summary now show the same email and manager.
