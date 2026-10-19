# Retro: only employees have a manager (demo data, EPIC-11 follow-up)

Built and validated locally, **not committed, not pushed**. Data and tests only: no migration, no role or required-feature change, nothing under `docs/` touched. **Staging still shows the old lines until the user re-runs `supabase/seed.sql`** (Supabase SQL editor, safe to run again).

## Why

The Organization tab (TASK-064) drew `users.manager_id` as it was seeded: Sam above Hana above Marco and Priya. The requirement docs define `manager_id` only as an employee's approver (BRD BR-02, PRD US-03 and US-04, ARCH); none puts a manager under HR or an HR Admin under another. The lines were a leftover of our own earlier "roles stack" model (HR approved managers' leave), and the seed comment already said they were "not used for any approval".

## What changed

- `supabase/seed.sql`: Hana, Marco and Priya have no manager (Sam already had none); employees unchanged (Marco has Elena and Jun, Priya has Leo). The old "point Hana at Sam" update is **removed**: it fired on every seed whenever Hana had no manager, so it would have undone this on each run. A new idempotent update clears the three on databases seeded earlier (`on conflict do nothing` cannot change existing rows); it names only those three ids and only rows that still have a manager.
- `src/lib/mock/users.ts`: the mock HR Admin and manager have `manager_id: null`.
- `supabase/tests/verify_seed.sql`: two new checks (no manager or HR Admin has a manager; every employee's manager is a manager). `supabase/tests/verify_schema.sql`: the check "Hana must have a second hr_admin as her manager" became "Hana, an HR admin, must have no manager". CI runs both.
- `src/lib/mock/seed-consistency.test.ts` (in `npm test`): parses the seed's users insert and asserts the rules above, that each mock user equals its seed row, that no later statement sets a manager on a manager or HR Admin, and that the clearing update names exactly the three ids and keeps its `is not null` guard.
- Demo runbooks: an "AC1b: reporting lines" section in the demo checklist and a note in the staging rollout.

## Found during validation

- **[FIX NOW] `verify_schema.sql` still asserted the old line** ("Hana must have a second hr_admin as her manager"). It runs in CI ("Verify schema invariants"), so the next push would have failed the `db-verify` job. My evaluate searched for application reads and `verify_seed.sql` but not `verify_schema.sql`; it was found only because the real-database run executed that file. Fixed above.

## Validation

- **Gate (exit codes read):** lint 0, prettier 0, tsc 0, `npm test` 0 (**1,184 passed, 180 skipped**), build 0 on a copy of the final code without `.env.local` (`diff -rq` on `src` and `supabase` clean).
- **Real PostgreSQL 18, 15 checks, 0 failed:** (A) a fresh database, new seed twice: row counts of every table equal after the first and second run, lines exactly the target, `verify_schema` and `verify_seed` pass. (B) an existing database seeded by the OLD seed (from `git show HEAD`), then the new seed twice: the old lines really were there before (Sam > Hana > Marco and Priya), afterwards they are cleared, employees unchanged, no row added or removed, both verify files pass. (C) the new `verify_seed` checks fail on the old seed alone with the right message, and also catch an employee with no manager and an employee under an HR Admin. (D) with the old update appended, Hana is re-attached to Sam and `verify_seed` catches it (the trap is real).
- **Mutation proofs (8 of 8 caught by the consistency test, files restored and `cmp`'d):** the old update back, Marco back under Hana, Hana back under Sam, the clearing update also clearing Leo, the clearing update without its `is not null` guard, an employee left without a manager, the mock HR Admin back under Sam, the mock manager back under Hana.
- **Browser** (production build on database B, mock cookie, one context per role, 1440 and 375 px): **54 checks, 0 failed.** Elena sees Marco above her and nobody else, and Request Leave still names Marco as reviewer. Marco's Overview and Organization tab say "No manager" ("top of the chart"), with Elena and Jun below and nobody from outside his team; his approvals queue and My Team show Elena and Jun and never Leo. Hana's Organization tab lists Hana (You), Marco, Priya and Sam at the top, Marco opens to Elena and Jun and Priya to Leo, her side card says she has no manager, Sam and Hana have nothing under them; the calendar's Team filter lists Marco and Priya and not Hana; Balance Overrides still shows Elena's request. No sideways scroll, no console errors. Screenshot looked at.
- **Not run:** GitHub Actions and Vercel (nothing pushed), staging itself (the user's re-run of the seed), the real sign-in path, a screen reader.

## Backlog (nothing blocking)

- Staging needs the seed re-run before the demo; until then it shows the old chart.
- `decide.ts` and `notify.ts` still carry comments about "an HR Admin who happens to be somebody's manager_id". They stay true as warnings (the SQL role check is what stops her) and were not edited.
- No database rule forces "only employees have a manager" (the docs do not ask for it and EPIC-8 may want the freedom); the seed test guards the demo data only.
