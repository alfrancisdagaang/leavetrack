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

| Action                            | Expected                                                                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DELETE FROM leave_requests`      | DB raises `restrict_violation`                                                                                                                                 |
| `UPDATE audit_log`                | DB raises `restrict_violation`                                                                                                                                 |
| soft delete (`is_deleted = true`) | excluded from active views and from the HR audit by default; shown (flagged) in the HR audit only with `include_deleted=true`; the row is never purged (US-05) |

## Canonical data-page pattern (streaming and failure)

For any signed-in page that reads data (learned in the page-load reliability task):

- The page awaits only the session, then renders its header and shell. Each data part is an async server
  component in its own `<Suspense>` with a skeleton fallback (key it when the URL changes the data).
- Reads go through `timedRead` (3 s first attempt, one retry, 8 s total). Writes never do: they run in
  `sql.begin` and are not retried. `timedQuery` stays for a read that must not be retried.
- A section that is decoration (a caption, a count) catches its own read failure and shows less. A section
  that is the point of the page shows an alert with a "Try again" link. A page never lets a read failure
  reach the generic error page.
- Fetch only what the page shows: a page that needs balances calls `getBalanceSummary`, not `getMySummary`.
- Test a section by calling the async component and rendering the element with `renderToStaticMarkup`.
  Vitest only picks up `*.test.ts` here, so no JSX in tests; mock `next/navigation` (`unstable_rethrow`).
- Smoke it for real: build in a throwaway copy (never while the user's server holds `.next`), point
  `DATABASE_URL` at a TCP socket that accepts and never answers, and check the first byte arrives in
  milliseconds, the page degrades with messages, and the log shows `Retrying read query`.

## Canonical security-verification pattern (cookies, CSP, logging)

Learned in TASK-025: a test that stubs the library proves only what the stub says (the old proxy test wrote
`{ httpOnly: true }` itself and hid a real `httpOnly: false` default). So:

- Assert what the code **asks the library for**, then run the **real library** once against a fake server and print only flags,
  never values (`@supabase/ssr` + a fake `fetch` returning a session).
- Check headers and cookies on the **production build** (`NODE_ENV=production`): build in a throwaway copy, serve on another port,
  `curl -D -`, and drive headless Chrome through the DevTools protocol (Node 22's global `WebSocket`; collect `Log.entryAdded` and
  `Runtime.consoleAPICalled`; read cookie flags with `Network.getAllCookies`). Run Node scripts with `bash`, not `zsh file`.
- A source-level guard test (`src/lib/security-guards.test.ts`) is only worth having if it **fails on a planted violation**: add one
  in a temporary file, watch it fail, delete it.
