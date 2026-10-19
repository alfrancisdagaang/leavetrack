# Retro: TASK-060, seed and demo data for the three roles (EPIC-10)

Not committed or pushed. TASK-061 (role scope validation and the EPIC-10 retro) is next. No `src/` change, no migration.

## What shipped

- `supabase/seed.sql`: leave policies and balances only for employees; the three demo requests from Marco, Priya and Hana (ids 03, 06, 07) are retired (never reuse them); a new over-balance request `30000000-...-08` for the override demo: **Elena, Sick, Mon 23 Nov to Wed 2 Dec, 8 working days** against a Sick balance of 5. Header and comments rewritten for three roles. The users block, UUIDs and the Hana-to-Sam statement are unchanged.
- `supabase/tests/verify_seed.sql` (new, read-only, for a fresh database): no policy, balance or request for a manager or HR admin (AC1); Leo reports to Priya and is never in Marco's team scope, Marco's queue has exactly four pending requests (AC2); exactly one pending request is over its confirmed balance by the override queue's rule and it is Elena's 8-day Sick request over a balance of 5 (AC3); counts of users, balances and audit rows.
- `.github/workflows/ci.yml`: "Seed twice" now compares row counts (users, policies, balances, requests, audit rows) between the first and second run and fails if they differ; a new step runs `verify_seed.sql`.
- `knowledge/runbooks/demo-checklist.md` rewritten for three roles (what each role sees, roles-limited checks, the override demo, limitation); `staging-rollout.md` section 2 says what the re-run adds and does not, with a read-only SQL query for the orphaned pending requests.

## Why Elena and Sick

Approving an override zeroes that balance, so any other pending request of the same person and type turns over-balance. Elena's only other pending request is Vacation, so the override leaves it alone (checked in a browser: it still offers Approve and Reject). She is the employee demo session and Marco's team, so Marco sees "Waiting for HR override, Reject only". 8 days stays over balance even after a couple of monthly accruals.

## Validation

- **Real PostgreSQL 18 (embedded), fresh database, migrations only then the seed:** the seed ran twice with identical counts (users 7, policies 6, balances 6, requests 5, audit rows 5); `verify_schema.sql` and `verify_seed.sql` both passed.
- **Six broken seeds, each on its own fresh database, all caught:** balances for every role (8 extra balances: AC1 probe); Leo moved under Marco (AC2 probe); the override request removed (AC3 probe, found 0); the override request made in-balance, 4 days (AC3 probe, found 0); a manager's request put back (AC1 probe); the requests insert without `on conflict` (the second run fails with a duplicate key, so the idempotency check fails; `verify_seed` alone passes it).
- **Upgrade of an already seeded database (the OLD seed from git, then the new one):** nothing deleted, all 7 old requests, 7 audit rows and 14 balances unchanged, the 14 old policies kept, exactly one request added (id `...08`). `verify_seed.sql` fails there ("seed gave 8 leave policies to a manager or HR admin"), as documented in its header: it checks what the seed creates, not what an older seed left.
- **Browser (headless Chrome, throwaway production build on the seeded database, mock sessions):** Elena's My Balance says "Waiting for HR override: over your balance by 3 days"; Marco's queue has Elena and Jun, no Leo, "Over balance by 3 days / Waiting for HR override" with **Reject only** on the Sick request, his card says 4 pending approvals; Hana's card says 1 awaiting override, `/approvals` redirects her, the override page lists Elena's Sick request, and none of these pages scroll sideways at 1440, 375 and 320. The override through the API: 200, Sick balance 0, the audit row records 8 days, balance before 5, shortfall 3; Hana's card drops to 0; Elena's Vacation request still offers Approve.
- **Gate:** lint, format:check, typecheck clean; 872 tests passed, 112 skipped (gated, need a database); the 10 seed-parser tests pass. No `src/` change, so the earlier `npm run build` in a throwaway copy still stands.

## Acceptance criteria

AC1 (the seed runs twice with no change and creates no balance or request for a manager or HR Admin): PASS (counts equal, probe, mutations). AC2 (Leo is on another team and never in Marco's queue): PASS (probe, browser). AC3 (an over-balance pending request for the override demo): PASS (probe and the full override in a browser). AC4 (the checklist matches the three-role model): PASS by review and by walking each step against the seeded app; it was **not** run on the live URL (the demo steps on staging are yours). **Not seen:** GitHub Actions (the new CI steps have only run locally, and the workflow file passed Prettier's YAML parse), Vercel, real Supabase.

## Found

- My first version of the CI step name contained a colon ("Seed twice (proves idempotency: ...)"), which is invalid plain YAML and would have broken the workflow. Prettier's parser caught it; fixed. Worth knowing for any new step name.
- The shortfall shown to the user depends on accrual. On a fresh seed it is 3 days; on staging, where one accrual run already added 1 day of Sick, it would be 2. The checklist says so.

## Backlog (needs your decision, nothing done)

- **Orphaned pending requests on staging** (Marco, Priya, Hana, and any from Sam): nobody can decide them, they stay Pending in the audit list. Options: leave as history (the default) or a soft-delete data migration. The runbook has the SQL to list them.
- **Accrual** still credits the old policies of managers and HR admins on staging each month (no page shows them). An employee-only join in `accrual.ts` would stop it; not in the CSV.
- The October calendar now has two bars (Elena's and Jun's) instead of four.
- Mark TASK-060 `Done` in the CSV only when asked.
