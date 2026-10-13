# Prompt — Review a task implementation

```
Review the changes for {TASK_ID} against AGENTS.md and knowledge/rules/coding-standards.md.

Check, and cite file:line for every finding:
1. Every AC has a test named after it, and it passes.
2. Authorization is enforced in SQL WHERE clauses — no fetch-then-filter in TypeScript,
   no client-supplied user/manager ids trusted.
3. No hard delete paths; every decision writes audit_log in the same transaction.
4. All route handlers use withErrorHandling; all failures use the standard envelope.
5. Inputs validated with zod; SQL only via tagged templates.
6. No console.*; nothing sensitive logged.
7. New env vars added to env.ts AND .env.example.
8. Migration (if any) is new, forward-only, mirrored in src/lib/db/types.ts, and covered in
   supabase/tests/verify_schema.sql.
9. Mobile: nothing requires horizontal scroll at 375px.
10. No scope beyond the task.

Classify: [BLOCKER] / [FIX NOW] / [BACKLOG].
```
