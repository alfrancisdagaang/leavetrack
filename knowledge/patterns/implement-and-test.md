# Pattern — Implement and test (per task)

The chain every dev task follows. Prompts live in `knowledge/prompts/dev/`.

```
load task ──► implement-task.md (E→P) ──► write-tests.md ──► implement (A) ──► review-task.md ──► validate (V)
                                              │                                         │
                                              └── tests written from ACs BEFORE code ◄──┘ (fix loop)
```

1. **Load** — `load_task {TASK_ID}`; confirm dependencies are done.
2. **Evaluate + plan** — `implement-task.md`. The plan names one test per AC and shows the SQL
   that enforces any authorization rule.
3. **Tests first** — `write-tests.md`. Run them; they fail for the right reason.
4. **Implement** — smallest change that turns them green, following `AGENTS.md`.
5. **Review** — `review-task.md`; fix every [BLOCKER] and [FIX NOW].
6. **Validate** — `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.
   If the task touched `supabase/`, also run the migration + seed + `verify_schema.sql` locally (README).
7. **Commit** — Conventional Commit referencing the task (`feat(leave): submit request form (TASK-011)`).

## Canonical scoping test

The seed's org chart exists to make this test trivial — use it for every manager-facing task:

| Actor (session)        | Target                                | Expected                               |
| ---------------------- | ------------------------------------- | -------------------------------------- |
| Marco Santos (manager) | Elena Cruz's request (his report)     | visible / actionable                   |
| Marco Santos (manager) | Leo Garcia's request (Priya's report) | **403**, and absent from Marco's queue |
| Elena Cruz (employee)  | any approval endpoint                 | **403**                                |
| no session             | any `/api/*`                          | **401**                                |

## Canonical retention test

| Action                            | Expected                                                |
| --------------------------------- | ------------------------------------------------------- |
| `DELETE FROM leave_requests`      | DB raises `restrict_violation`                          |
| `UPDATE audit_log`                | DB raises `restrict_violation`                          |
| soft delete (`is_deleted = true`) | excluded from active views, present in HR audit (US-05) |
