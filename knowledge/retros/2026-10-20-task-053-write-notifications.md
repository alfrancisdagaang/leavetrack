# Retro: TASK-053, write notifications in the existing transactions (EPIC-9)

Not committed, not pushed. Builds on TASK-052 (the table, also uncommitted).

## What shipped

- `src/lib/leave/notify.ts`: `notifyLeaveEvent(tx, { kind, requestId, employeeId, actorId, toEmployee, toManager })`, **one statement**, called inside each event's own `sql.begin`. Recipients are worked out in SQL from the employee's own `manager_id` (never from the caller or the client): the employee when `toEmployee`; the employee's manager when `toManager` and only if that person's role is `manager`; never `actorId`. Only ids and the kind are stored.
- `createLeaveRequest` (`submitted` to the manager), `decideLeaveRequest` (`approved` or `rejected` to the employee), `overrideLeaveRequest` (`overridden` to the employee and the manager; an HR rejection is `rejected` to the employee only). Each call sits right after its audit insert, so a failed notification throws and rolls the whole event back.
- Tests: unit tests per event and per refusal in `service.test.ts`, `decide.test.ts`, `override.test.ts`, new `notify.test.ts`; gated `notifications-events.integration.test.ts` (12 tests, real PostgreSQL).

## Decisions taken (defaults from the plan; you did not object)

1. HR override **reject**: employee only, kind `rejected`.
2. A `submitted` notification goes only to a manager whose role is `manager`. An HR Admin who is somebody's `manager_id` hears nothing (they cannot approve since EPIC-10).
3. The actor is never a recipient, enforced in SQL.
4. No uniqueness constraint on (recipient, request, kind): every path runs once under a row lock and a `status = 'pending'` guard.

## Validation (real PostgreSQL 18.4, embedded)

- Gated events test: 12 of 12. It covers exact recipients per event (including another team's manager and employee, and an employee whose manager is an HR Admin), refusals writing nothing, the actor guard called directly, and **rollback of the whole event** for submit, decide and override (a temporary trigger on `notifications` raises for this file's own recipients; request count, audit count, status and balance are unchanged afterwards, and the same decision succeeds once the trigger is gone).
- **Mutation proofs, 11 single mutations** (no actor guard, no manager-role filter, manager = employee, notification skipped in each of the four paths, reject kind swapped, decide tells the manager, override skips the manager, submit tells the employee): the unit tests caught all 11; the gated test caught 9. Two survived the gated test, `decide-tells-manager` and `submit-tells-employee`, because in both the wrongly named recipient is the actor and the actor guard hides it. Removing the actor guard as well (two paired runs) makes the gated test fail 4 tests each, so the behaviour is covered.
- Gate: lint, format:check, typecheck clean; 887 tests passed, 129 skipped (gated); `npm run build` passed in a throwaway copy.
- All 17 gated files: 16 files pass together. `override-count` fails 3 tests in a combined run (see below); it passes alone and passes after my file ran. `dashboard-lists` ran alone: 10 of 10.

## Found

- **`override-count.integration` is racy in a combined run, and it was before this task.** Without my file, two combined runs of the 16 other gated files both failed its 3 tests. Its header says why: it counts HR-wide and must not run beside any file that inserts over-balance requests (`override.integration`, `override-queue`, `override-states`, and now mine). The earlier "all pass together" result was luck of timing. Run it alone. I noted the same constraint in my file's header.
- **My TASK-052 gated plan test was flaky in a combined run:** it asserted one index name, but which of the two recipient indexes the planner picks depends on statistics that other files change. Fixed: it now asserts an index scan on either and no `Seq Scan`, and checks the partial index's definition from `pg_indexes`. Dropping the partial index is still caught (by the definition check).
- Harness: `vitest run <17 paths>` printed "No test files found" in some invocations and `--exclude` combined with a filter swallowed the filter; `vitest run .integration.test --exclude '**/dashboard-lists*'` works.

## Not seen

GitHub Actions for TASK-052 and TASK-053 (including `db-verify` with the new probes), and staging. Nothing reads the notifications yet; TASK-054 does.

## Open

- The CSV rows for TASK-052 and TASK-053 and the handoff are not updated (only when asked).
- A manager or HR Admin never hears about their own leave (they cannot request any); nothing to do.
