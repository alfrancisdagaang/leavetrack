# Prompt — Write tests from acceptance criteria

```
Write Vitest tests for {TASK_ID} / {US_ID}.

For each acceptance criterion:
1. Name the test "{US_ID} AC{n}: <criterion summary>".
2. Arrange with seed-shaped fixtures (UUIDs from supabase/seed.sql / src/lib/mock/users.ts).
3. Assert the observable outcome AND the absence of side effects where the AC implies one
   (e.g. "no request is created", "no balance change occurs").

Always add, where relevant:
- Scoping: a manager (Marco Santos) acting on another team's employee (Leo Garcia) → 403,
  and that request is absent from list responses.
- Envelope: every failure returns { success: false, error: { code, message } } with the right status.
- Unauthenticated: 401 envelope.
- Wrong role: 403 envelope.
- Accrual: exact numeric result (e.g. 10.00 + 1.25 = 11.25) and idempotency (second run → unchanged).
- Soft delete: deleted rows excluded from active views, still present in audit views.

Mock the logger. Do not hit a real database in unit tests.
```
