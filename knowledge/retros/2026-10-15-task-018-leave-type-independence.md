# Retro — TASK-018 independent leave-type balances (2026-10-15)

Scope: tests only (US-08). No production code changed; the behaviour already existed in `decide.ts` and `service.ts`.

## Acceptance criteria

| AC                                                                    | Proof                                                                                                                                                        | Result |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| AC1 Sick approval decrements only Sick; Vacation and Unpaid unchanged | `decide.test.ts` (fake SQL: one balance update, Sick id only) and `leave-types.integration.test.ts` (real DB: Sick 5 to 2, Vacation stays 10, no Unpaid row) | PASS   |
| AC2 Unpaid is never blocked by a balance check                        | `service.test.ts` (4 cases) and the real-DB test (submit and approve Unpaid with no balance row; balances identical afterwards)                              | PASS   |

Also added `balance-writers.test.ts`: only `decide.ts` and `accrual.ts` may write `leave_balances`.

## Verification

- Real-database test run on a throwaway `leavetrack_test` database (PG 18, port 54329, migrations applied): 2/2 passed. Database dropped afterwards.
- Mutation check: temporarily making the balance update target the Vacation id made 3 tests fail (2 fake-SQL, 1 real-DB); change reverted.
- `lint`, `format:check`, `typecheck` and `npm test` pass (209 passed, 2 skipped = the gated tests).
- `npm run build` was **not** run: the user's `next start` was listening on port 3000 and a build replaces `.next` under it. The change is test files only.

## Issues

None at BLOCKER or FIX NOW level.

## Backlog

- [ ] Gated integration test is not wired into CI (`TEST_DATABASE_URL` in `db-verify`); still the open "real-database tests in CI" item.
- [ ] `balance-writers.test.ts` matches `insert into|update|delete from public.leave_balances` by regex; unusual formatting (a schema-less table name, a dynamic table) would slip past it.
