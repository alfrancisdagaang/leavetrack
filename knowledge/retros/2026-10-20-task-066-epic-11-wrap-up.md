# Retro: TASK-066, My Profile end to end and validation (EPIC-11 wrap-up)

Built and validated locally, **not committed, not pushed**. Tests and docs only: no product code, no migration, no role or required-feature change, nothing under `docs/` touched. **EPIC-11 is five of five tasks built** (TASK-062 to 066). TASK-026 (change password, EPIC-2) is **superseded by TASK-065**, which added the current-password check and the sign-out of other sessions. Its CSV row already says `Superseded`; no EPIC-11 CSV row has been marked.

## What was added

- `src/app/api/org/org-e2e.integration.test.ts` (15 gated tests, real PostgreSQL 18.4, migrations only, no seed). The real Overview and Organization server components render to HTML from real reads, and the real `GET /api/org/children` handler runs; only `getSession` and `requireDb` are replaced. The organization follows the demo rule (HR Admins and managers have no manager; employees report to a manager) with another team (Priya's), a 7-person chain, 55 reports and a loop. It covers the employee, manager and HR charts and nobody from another team; HR paging (56 reports: 50, then 6, a page past the end clamped to the last page with its 6 people); only id, name, role and report count leaving the route; 401 for a visitor, 403 for an employee and a manager; a client-supplied viewer ignored (for an employee, and for HR naming someone else); an unknown parent giving the same empty page as a person with no reports; 400 for a malformed parent or page; a loop read safely with each person once; a moved person changing the next read for both teams.
- `query-budget.test.ts`: the Account settings page reads **no** database statement (peak 0). Every profile page is now covered: Overview 1, Organization employee 1, manager 1, HR 2, Account settings 0; the layout and the bell still add none.

## Validation

- **Gate (exit codes read):** lint 0, prettier 0, tsc 0, `npm test` 0, build 0 on a throwaway copy of the final code without `.env.local` (`diff -rq` on `src` and `supabase` clean).
- **Mutation proofs: 9 of 9 caught** (files restored and `cmp`'d): the employee read returning peers, the manager walk without its cycle guard, without its depth cap, the HR page not clamped, without a row limit, the HR route trusting a viewer id from the query, **both HR guards removed together** (the route's role check and the SQL's, which back each other up), `email` selected on HR pages, and the settings page reading the database. Three of the assertions needed strengthening to catch their mutation (the depth cap, the clamped page's people, HR naming another viewer); they were added before the proof.
- **Browser matrix** (headless Chrome, production build of the final code, seeded PostgreSQL 18.4, a fake Supabase Auth server so the REAL sign-in path ran, one context per user, plus a 7-person chain under Jun whose first name is 140 unbroken characters and 55 more reports under Priya): **173 checks at 1440, 768, 375 and 320 px, 0 failed**, for Elena (employee), Marco (manager) and Hana (HR Admin). Overview, the three tabs by link, exactly one current tab, Account settings form, no sideways scroll on every tab and with every node open; Elena never sees Jun, Leo, Priya, Hana or Sam; Marco never sees Leo, Priya, Hana, Sam or Priya's reports even with everything open, and the depth cap says "N reports not shown" with the 8th level not drawn; Hana sees Sam, Hana, Marco and Priya at the top and no employee, Enter opens Priya with the first 50, focus stays on the toggle, "Show 5 more" loads the rest, nothing exposes another person's email; the keyboard reaches the tabs; no CSP violation or script error. Screenshots of Hana at 1440 looked at; the 375 screenshot of Marco was the Overview (the last page the script visited), so the Organization tab at 375 rests on the checks above and on the TASK-064 screenshots.
- **Load check (AC4)**, embedded PostgreSQL 18.4 on this Mac, scratchpad databases only, the current seed shape (3 HR Admins and 40 managers without a manager, employees spread under managers; a second database of 1,400 people with one manager holding 600 reports), 25 runs each:

  | Read (median / max, ms)       | 800 users | 1,400 users, 600 reports |
  | ----------------------------- | --------- | ------------------------ |
  | `getEmployeeOrg`              | 0.4 / 1.2 | 0.3 / 0.6                |
  | `getManagerOrg` (typical)     | 0.6 / 1.1 | 0.5 / 0.7                |
  | `getManagerOrg` (600 reports) | n/a       | 1.1 / 1.4                |
  | `getOrgRoots` (HR)            | 0.5 / 0.8 | 0.4 / 0.5                |
  | `getOrgChildren` page 1       | 0.3 / 0.4 | 0.4 / 0.5                |
  | `getOrgChildren` page 12      | n/a       | 0.4 / 1.3                |

  Every read is about 1 ms against an 8,000 ms deadline. EXPLAIN (analyze, buffers): the manager walk starts from `users_pkey` and `users_manager_id_idx`, then a hash join over a sequential scan of `users` for the recursive step (16 buffers at 1,400 rows); the report count for the manager with 600 reports uses a sequential scan (a planner choice at that selectivity, 16 buffers). Re-check if the table grows by orders of magnitude.

## Found during validation

- **No product defect.** Harness slips only: the first run of the matrix read the Overview before its streamed section arrived (3 false failures); it now waits for "Loading…" to go. A first loop assertion counted a name four times, which is legitimate in a two-person loop (the manager card, the side card, the summary and the tree node); it now checks the read's person ids.
- One real test gap found and closed: nothing asserted the depth cap or the clamped page's people, so the matching mutations would have survived.

## Not seen

GitHub Actions and Vercel for these commits, staging (the seed re-run is still the user's step), **real Supabase** (the real sign-in path ran against a fake Auth server; the org reads and the password change are proven on real PostgreSQL and a fake Auth), real Supabase latency, a screen reader. The gated real-database tests do not run in CI (no `TEST_DATABASE_URL`).

## Backlog (nothing blocking)

- Everything in the TASK-063, 064, 065 and reporting-lines retros still stands (roots past 50 cannot be paged, an opened HR node does not refresh, the HR expand button is icon-only, the 320 px tab strip scrolls inside itself, the change-password error is not tied to a field, and so on).
- The Organization tab at 375 px for a manager has no screenshot from this run.
- EPIC-11 CSV rows (TASK-062 to 066 and the header) are not marked `Done`; do it when asked.
