# Retro: TASK-062, My Profile shell, tabs and Overview (EPIC-11)

Built and validated locally, **not committed, not pushed**. First task of EPIC-11 (evaluated as a whole, planned and built one task at a time). No migration, role or required-feature change; nothing under `docs/` touched.

## What shipped

- `/profile` for every role (Overview), with `/profile/organization` and `/profile/settings` as placeholders ("not available yet") until TASK-064 and TASK-065.
- `getProfile` (`src/lib/leave/profile.ts`): ONE statement, scoped to the session user's id in the SQL, manager's name by a left join on `manager_id`; nothing else of the manager is selected.
- `ProfileTabs` (a `<nav>` with `aria-current`, links not `role="tablist"`), `ProfileFrame` (header + tabs; used instead of a `layout.tsx`, which cannot know the open tab), streamed `OverviewSection` with its own failure note, skeletons, `loading.tsx`.
- Account menu has a **Profile** link (new navy `user-dark.svg`); the top bar reads "My Profile" through `pageTitleFor` (`nav.ts`), and no sidebar item is highlighted there.

## Validation

- **Gate (exit codes read):** lint 0, prettier 0, tsc 0, `npm test` 0 (**1,068 passed, 164 skipped**, gated), build 0 on a throwaway copy without `.env.local`.
- **Unit tests:** read (scoped id, one statement, null manager, unknown id, only the manager's name selected), section (all three role labels, "No manager", failed read and not-found both alert, long unbroken name, no department/title/photo/links), tabs, all three pages (session first, one h1, right tab current), nav title, app frame title for every role, account menu link, and the query budget (Overview is exactly 1 statement).
- **Browser** (headless Chrome, production build, seeded PostgreSQL 18, mock cookie, one context per role): **246 checks at 1440, 768, 375 and 320 px for employee, manager and HR Admin, 0 failed**, plus 44 more with a 136-character unbroken name and a person with no manager (**0 failed**). Covers: name, role, email, manager; one h1; Overview current; no sidebar highlight; top bar title; Profile link in the menu (at least 44 px) that opens `/profile`; keyboard Enter on the Organization tab; no sideways scroll on all three tabs; no console errors; no session sends all three URLs to `/login`. With the database stopped the page keeps its header and shows the alert and retry. Screenshots looked at.
- **One fix found by looking:** at 375 px the tab strip clipped "Account settings". Padding is tighter below `sm` (`px-2`, `gap-1`), so all three fit at 375 px. At 320 px the strip scrolls inside itself (the page does not).
- **Not run:** gated real-database tests (no new rule beyond one scoped select), mutation proof (same), GitHub Actions, Vercel, the real sign-in path, a screen reader.

## Backlog (nothing blocking)

- At 320 px the tab strip scrolls sideways inside itself; nothing hints at it.
- With the mock login, the top bar shows the mock user's name while Overview reads the database row, so they can differ if the row was edited (a real session resolves the same row for both).
- The placeholder tabs must not reach the demo unless wanted: TASK-064 and TASK-065 replace them.
- The last build ran before a class-order tidy in `profile-tabs.tsx` (cosmetic); lint, prettier, tsc and tests ran after it.
