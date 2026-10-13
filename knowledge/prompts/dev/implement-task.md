# Prompt — Implement a dev task

Use with `/epav` (or `/evaluate` → `/plan` → `/apply` → `/validate`).

```
Implement {TASK_ID} from docs/dev-tasks/epic-1-leave-request-tasks.csv.

EVALUATE
- Load the task (load_task) and its user story in docs/prd/PRD-LeaveTrack-v1.0.md.
- List every acceptance criterion verbatim.
- Identify the tables, routes, and roles involved (docs/arch-docs/ARCH-LeaveTrack-v1.0.md).
- Check the task's dependencies are done.

PLAN
- Files to create/modify, with one line each on why.
- For every AC: the test that proves it.
- Any authorization rule: show the exact SQL WHERE clause that enforces it.
- Any write to leave_requests: show the audit_log insert in the same transaction.

APPLY
- Follow AGENTS.md and knowledge/rules/coding-standards.md.
- Route handlers: withErrorHandling + zod + assertRole.
- No scope beyond the task.

VALIDATE
- npm run lint && npm run typecheck && npm test && npm run build
- Map each AC to a passing test by name.
```
