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

## Canonical scoped-read-of-another-person's-data pattern (My Team and the team member page)

Learned in EPIC-4, where a manager reads a direct report's data (BR-02: another team's data is a data-exposure incident):

- **Put the scope in the first CTE and read everything through it.** A `member` CTE finds the person only if
  `u.manager_id = ${caller}`; the balances, the pending ranges, the filtered requests and the count all `join member`. One statement means
  no gap for a manager change to slip through, and every way of not being allowed (another team, a missing person, a deleted one, the
  caller themselves, their own manager, a peer, a stranger, a malformed id) is the same empty result. Test each of them against the real
  engine, and prove the scope test can fail by breaking the predicate (`or true`) on a fresh database.
- **Choose sensitive columns in the SQL.** `case when r.status = 'pending' then r.reason end` means a decided request can never carry the
  free-text reason, whatever the page does later; the UI also refuses to show it (defence in depth) and a test plants a reason on a
  decided row. The same idea applies to any column that must not leave the database for some rows.
- **End every "cannot open" case the same way.** The page calls `notFound()` for a bad address and for a null read, with one segment
  `not-found.tsx` that says nothing about why. Streaming can send the shell first, so the HTTP status may be 200; what must hold is that
  the bodies are identical (compare them byte for byte in the browser).
- **A roster is one statement, not one query per person.** Subselects per row (out today, next leave, pending, last request, balances)
  stay at one pooled connection however big the team is. Compute shared figures with the existing pure function (`summarizeBalances`) so
  they equal the person's own page by construction, and test the equivalence.
- **Filters from the address:** parse each value on its own, ignore a bad one with a visible note, keep the others; never fail the page.

## Canonical filters-without-a-page-reload pattern (the team member page)

Learned when "Apply" reloaded the whole page: a plain `<form method="get">` makes the browser load a new document. Keep the form as a GET form
(so it still works without JavaScript), but apply it with the router: a small client `FilterShell` holds `useTransition` and `router.push(href,
{ scroll: false })`, the form's `onSubmit` and the chips' links call it, and a `ResultsRegion` wrapper dims the old results and sets `aria-busy`
until the new ones arrive. The address still changes (back button, reload, bookmark), the server still validates every value, and the layout,
header and filter card stay mounted. Give the `<form>` a `key` built from the applied filters, so its selects always show what is applied
(also after the back button). To prove it in a browser: set `window.__marker`, record `performance.timeOrigin`, tag a few DOM nodes with an
expando, click Apply, then check all of them survive and that no Document request was made (a reload would reset every one of them). Beware
`x ?? 0 === 2` in a polling condition: it parses as `x ?? (0 === 2)` and returns at once; parenthesise the left side.

## Canonical enum-value migration pattern (and real Postgres on the Mac)

Learned in TASK-037 (2026-10-19), adding the `override_approved` audit action to a Postgres enum.

- **Adding an enum value and using it are two migration files.** A new value cannot be used in the transaction that adds it
  (`unsafe use of new value`), and `supabase db push` and `psql` may wrap a file differently. File 1 is only
  `alter type ... add value if not exists`; file 2 holds the constraints and columns that mention it. Values can never be removed, so
  agree the names before anything is pushed (`db-push` applies them to staging on the next push to `main`).
- **A rule that mentions the new value goes in file 2**; re-check existing rows are valid under it (here no old audit row uses the new
  action, so the CHECK holds for all of them). Keep new columns nullable so the append-only triggers never see a rewrite, and put the all-or-none rule in a
  CHECK so the database, not the app, enforces it.
- **Real Postgres without Docker:** `npm i embedded-postgres` in the scratchpad (never the repo) gives PostgreSQL 18 for darwin-arm64.
  Apply each migration with `sql.unsafe(file)` (one simple query per file, the stricter runner), the seed twice, then
  `supabase/tests/verify_schema.sql`, and leave the server up for `TEST_DATABASE_URL` runs. Use it instead of pglite for any test that
  expects a SQL error: **pglite-socket mixes up results after the first SQL error** (the next query returns `[]`, later results shift
  by one), which looks like a bug in the test.
- Prove the probes can fail: copy `supabase/` to the scratchpad, weaken one rule per copy, run the verify script and the gated test on a
  fresh server each, expect exactly the matching probe to fail.
- Run the gated suites on one fresh database; `dashboard-lists` fails its "at most five" assertions when other files have inserted rows first.
  "Fresh" means migrations only, **no seed** (the seed's demo requests crowd HR's five rows too). Even on a fresh seedless database it is
  **racy against the other gated suites**: four runs of the whole gated set without any override file failed 2, 1, 1 and 0 of its tests, so
  do not read one green or red run of the combined set as proof of anything. Run `dashboard-lists` alone, and say in the header of any gated
  file that inserts requests or audit rows that it must not share a database with it.
- **A gated test only proves a filter if the row would otherwise match.** The first `tracks_balance` test gave the Unpaid employee no
  balance row, so the inner join already excluded the request and deleting the filter changed nothing. Run the mutation, and if it
  survives, give the row everything except the property under test.
- **Put a long unbroken word in the browser data.** Free text (a reason, a note) with a 60-character word with no spaces is what breaks
  the 375 px and 320 px layouts: a grid cell needs `min-w-0` and the text `break-words`, or the page scrolls sideways. TASK-040 found
  this on the manager's rows only because the test data had one. Assert the classes in a unit test (it is easy to lose) and measure
  `scrollWidth <= clientWidth` in the browser.
- **Shared rules go in one pure function.** "Over balance" had three meanings (manager `insufficient`, the request form's _available_,
  the HR queue). One `checkOverBalance` now serves the manager rows, the member page, the employee list, and a gated test proves it
  agrees with the HR queue's SQL.
- **A decision can change what else is in a queue.** Approving an override sets the balance to 0, so the employee's other pending
  requests become over-balance and join HR's queue: the count can stay the same after a decision. Assert that the decided request left, not
  that the count dropped.
- **Adding a writer to a guarded table** (here a second `update public.leave_balances`) fails a guard test such as
  `balance-writers.test.ts` until the new file is added to its allow-list on purpose. Run the full `npm test` before calling a task done,
  not only the files you touched.
- Mutation proofs for a route's SQL: copy the module to the scratchpad, patch one rule with a small script (assert the pattern exists),
  run the gated file, restore, and `cmp` against a saved copy. When two guards back each other up (a status check after a lock and a
  `status = 'pending'` in the UPDATE), remove both to prove the behaviour is covered.
