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

## Canonical real-database-without-Postgres pattern (pglite)

Learned in US-11: there is no local Postgres on the Mac, so the gated `*.integration.test.ts` files and a browser check can run
against `@electric-sql/pglite` + `@electric-sql/pglite-socket` installed **in the session scratchpad** (never in the repo).

- Apply `supabase/migrations/*.sql` in order, minus the `create extension ... pgcrypto` line (pglite has no pgcrypto; Postgres 13+
  has `gen_random_uuid()` built in). Add `supabase/seed.sql` only for a browser check, never for an integration test.
- pglite is **one session**. Parallel connections share the unnamed prepared statement, so queries fail with
  `bind message supplies N parameters, but prepared statement "" requires M`. That is the harness, not the code: run **one
  integration file at a time**, and for a browser check make the throwaway copy's pool `max: 1` (copy only, never the repo).
- Restart the server before **every** run. Fixture rows cannot be deleted (triggers), and leftover rows silently crowd out any
  `limit` assertion, so a second run on the same instance gives failures that look like the bug you are hunting.
- Prove a scoping test can fail: break the filter in the source, run on a **fresh** database, expect exactly the scope tests to
  fail, restore the file and `diff` it against a backup.

## Canonical pool-budget pattern (parallel reads per page)

Learned 2026-10-18: US-11 took the dashboard from 4-5 to 6-7 parallel reads against a pool of `max: 5`, and pages began to stall
("fine for a few clicks, then slow, then a deadline"). Against the real pooler, 4 and 5 parallel reads per page stayed clean; 6
hung, more of them on every page load, until all of them did.

- **A page's parallel reads must stay at `POOL_MAX - 1` or fewer** (`src/lib/db/client.ts`). `timedRead` retries a stalled read, but the
  abandoned first query keeps its connection, so a page that needs the whole pool has no connection left for the retry and one stall
  cascades into every page of that instance, because they share the pool.
- Count the **statements**, not the helpers: a helper that wraps `Promise.all` of three selects costs three connections. Prefer one
  statement (scalar subselects returning JSON, as `loadSummaryRow` in `src/lib/leave/service.ts`) over several parallel ones, and
  `count(*)` over fetching rows to count them.
- `src/lib/db/query-budget.test.ts` runs each page's real data sections against a fake client that records the peak number of
  statements in flight. A new card or section that goes over fails it. Add the page there when you add one.
- Prove it can fail: run the test against the previous code in a throwaway copy and expect exactly the over-budget pages to fail.
- Measure against the real pooler from the Mac with read-only statements (`select 1`, `pg_sleep`), never print `DATABASE_URL`,
  and give every hung probe a hard `process.exit` so it cannot hold connections.

**Adding a read to a page (learned adding the My Balance breakdown):** count the page's statements before and after, and keep the
total at `POOL_MAX - 1` or fewer. Fold the new figures into the page's own statement (JSON subselects, `sum(...)` in SQL) instead of
adding a parallel read, and give the page its **own** statement when the shared one also runs on other pages or inside a transaction
(`loadSummaryRow` runs in the submit transaction): then the other pages cannot change, and an equivalence test between the two
statements proves the figures they share still agree. Count working days with `countWorkingDays` on ranges the SQL has already
clipped, so there is one definition of a working day.

## Canonical responsive-table pattern (My Balance requests)

Learned in the My Balance redesign: a data table that must not scroll sideways at 375 px is rendered as **two native structures with
the same rows**, one hidden by CSS at each size (`hidden … sm:table` for a real `<table>` with `<th scope="col">` headers, a row header
and an `aria-label`; `sm:hidden` for a stacked `<ul>`), not as one table whose `display` is switched to `block`. Changing a table's
display drops its semantics in some screen readers, and ARIA roles only patch that. The cost is that the rows appear twice in the HTML,
which is fine for a capped list (50 rows); tests then assert both structures. A guard test that renders the component and rejects
hex or `rgb(` colours and inline styles must allow `next/image`'s own `style="color:transparent"`, and must be proved by planting a
violation (`bg-[#ff0000]`), watching it fail, and restoring the file.
