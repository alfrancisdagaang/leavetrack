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
- **A role matrix needs one browser context per role.** Pages opened in one Chrome share one cookie jar, so a later `setCookie` silently
  changes the role of every page already open (EPIC-10: all three "roles" ran as HR and a "no session" visit stayed signed in; 30 false
  failures that looked like missing role gates). Use `browser.createBrowserContext()` per page, and have each role's page prove who it is
  ("Welcome back, <name>") before it calls anything. Run refusals first and compare row counts before and after, then the allowed
  mutations; use a fresh database for every full run.
- **Do not assert a 404 status for a streamed `notFound()`.** A page that streams has already sent 200 when `notFound()` runs under
  Suspense, so the status stays 200 and the not-found screen renders. Assert the content instead: for another team's member it must read
  exactly like a person who does not exist and carry none of their data.
- **A new CI step name with a colon is invalid YAML** (`name: Seed twice (proves idempotency: ...)`). `prettier --check` on the workflow file
  catches it before CI does; there is no other local YAML parser in the repo.

## Canonical new-table migration pattern (learned in TASK-052, 2026-10-20)

- **A new table breaks `verify_schema.sql` on purpose.** It asserts the table count and the RLS count by name, so add the table to both
  lists and bump both numbers in the same change, or CI `db-verify` goes red. Add one probe per rule (CHECK, immutable columns, no delete,
  no truncate), each in a `begin ... exception when <class> then null` block that raises if the rule did not fire.
- **A text column with a CHECK list instead of an enum** (a value that may need removing later) is mirrored in `types.ts` by hand. Pin it with
  an ungated test that parses the CHECK list out of the migration file and compares it to the TypeScript tuple.
- **`ON DELETE RESTRICT` raises 23001 (`restrict_violation`), not 23503**; so do the repo's guard triggers. 23503 is for a missing parent on insert.
- **`verify_schema` cannot see indexes.** Prove an index with a gated `EXPLAIN` test (`set local enable_seqscan = off` inside `sql.begin`,
  a few hundred rows, `analyze`) and mutation-test it by dropping the index. Mutation-test the rest by weakening one rule per copy of `supabase/`
  and expecting exactly the matching probe to fail; check which of the two suites catches each, since some rules only one of them can see.

## Canonical notify-in-the-same-transaction pattern (learned in TASK-053, 2026-10-20)

- **One statement, recipients from the database.** `notifyLeaveEvent(tx, ...)` is called inside the event's own `sql.begin`, right after the
  audit insert, and works out the recipients in SQL from the employee's `manager_id` (never from the caller). A failed insert throws and
  takes the whole event with it. Do not wrap it in try/catch.
- **Prove the rollback with a scoped failure trigger.** In a gated test create a `before insert` trigger on the table with
  `when (new.recipient_id in (<this file's own users>))` that raises, run the event, and assert the request, audit and balance are unchanged;
  drop it in `finally` and in `afterAll`. Scoping the trigger to the file's own ids keeps other gated files unaffected.
- **Two guards that hide each other need a paired mutation.** The actor guard hid "decide tells the manager" and "submit tells the employee"
  (the wrongly named recipient is the actor), so each single mutation survived the gated test. Remove both together to prove the behaviour
  is covered; the unit tests on the statement's values catch the single ones.
- **A gated file that inserts over-balance requests races `override-count.integration`** (an HR-wide count). It failed in combined runs
  before TASK-053 too. Run it alone and say so in the header of any new file that inserts over-balance requests.
- **Assert what must always hold about a query plan**, not which of two eligible indexes the planner picks: other files change the statistics
  while a combined run is in progress. Assert an index scan and no `Seq Scan`, and check an index's definition from `pg_indexes`.
- Harness: `vitest run <many paths>` can print "No test files found", and `--exclude` swallows a positional filter; use one substring filter
  (`vitest run .integration.test --exclude '**/dashboard-lists*'`), or move a file aside to get a baseline.

## Canonical shared-chrome client component pattern (learned in TASK-055, 2026-10-20)

- **Anything in the layout runs on every page, and a page budget has no spare statement.** Do not add a server read to the layout or shell.
  Read in the browser through an existing route, after the page has loaded (idle callback), and guard it with a source-level test in
  `query-budget.test.ts` (no value import of the db client, the service or the module's SQL; no effect keyed on the pathname).
- **The repo has no DOM test environment.** Put the logic in a pure reducer and pure helpers (unit tests), render the presentational part with
  `renderToStaticMarkup`, and prove the interaction in a real browser (puppeteer-core in the scratchpad, one context per role, throwaway
  production build). Do not trust a mock-based test of an optimistic update.
- **Optimistic UI plus a read in flight is a race.** A read that started before a click answers with the pre-click list and undoes the click.
  Invalidate older reads when a mark starts, and read again when it settles. Test it by fetching the answer from Node before the click and
  delivering it later through request interception: delaying the REQUEST is not enough, the server then answers after the click.
- **An anchored dropdown next to the avatar can leave the viewport at 320 px.** Below `sm` use `fixed inset-x-4` under the bar; from `sm`
  `absolute right-0 w-96`. Assert the panel's rect is inside the viewport at 1440, 375 and 320.

## Canonical route-level end-to-end test pattern (learned in TASK-057, 2026-10-20)

- **Go through the real route handlers, services and SQL, and replace only two things:** `vi.mock("@/lib/auth/session")` (who is signed in, a
  `holder.session` you set per call) and `@/lib/leave/service`'s `requireDb` (return the test client; keep the rest with `importOriginal`).
  Import the route modules with `await import(...)` after the mocks, call `POST(new Request(...), { params: Promise.resolve({ id }) })`, and
  assert on the real `Response` (status and the standard envelope). No Next server is needed.
- **Prove the mock does not leak to the real `getDb()`** by reading back from the test client in the same test (a count of what the routes
  wrote); if the routes had reached another database that query would not see the rows.
- **Assert exactness, not only presence:** one `group by` query over everything the flow created must equal the expected set, so a notification
  to the wrong person or a duplicate fails even when each step's own check passes.
- **Mutation-test it at the route level too:** the same mutation scripts used for the services must each fail this file; a mutation that only
  the unit tests catch means the end-to-end flow has a hole.

## HR-wide read pages (EPIC-7, the company calendar)

- **A read whose scope is "everyone" still carries the role in its SQL.** Each read takes the signed-in user's id from the server session and starts with
  `exists (select 1 from public.users h where h.id = ${viewerId}::uuid and h.role = 'hr_admin')`; `requireRole` on the page is only the first gate. A gated test runs every
  read as a manager, an employee and an unknown id and expects empty answers, and the same read as HR must be non-empty (otherwise the empty answers prove nothing).
- **Count people and requests separately.** The grid said 35 out and the day list said 42 because one person can hold two requests. Count `distinct user_id` for "out"
  (grouping sets give the per-type rows and the day total in one statement) and say "N requests" on the list.
- **Bound a date-range join by the range itself.** Joining every live request to each generated day read 6,803 rows for a one-month view; adding
  `start_date <= month end and end_date >= month start` read 700 (5.6 ms to 2.1 ms). It cannot change a result, so only a timing proves it.
- **Filters as a plain GET form** keep a page free of client code, and the browser script must wait for the streamed body after a client navigation (a Next `<Link>`
  click does not fire `waitForNavigation`): wait for the URL to change, the network to go idle, and a known element to appear.
- **A detail panel beside a grid leaves dead space when nothing is open: use a modal `<dialog>`.** Render it open on the server (it still shows without JavaScript) and reopen it with
  `close()` then `showModal()` in an effect; `cancel` (Escape) and a click on the dialog element itself (the backdrop) both go back to the list address. Keep the Suspense key free of
  the open item so the page behind stays on screen while the popup loads. **The page behind a modal is inert**, so a browser test must start from the closed page before it uses
  the filters, and a check for a centred title must keep a side button out of the same flex row.
- **Judge the gate by exit codes, not by the last line of output.** `npm run lint | tail -1` printed an empty line while ESLint had reported an error higher up (a `react/no-children-prop`
  in a test written the same session), so "lint clean" was claimed wrongly once. Run `npm run lint; echo "exit $?"` (and the same for `tsc` and `prettier --check`), and read the exit code.
- **A page that must stay inside the parallel-statement budget gets new figures by replacing a read, not adding one.** The manager dashboard already used all 4, so the new "out" figures
  and the pending-approvals count came back from ONE statement that replaced the balance summary (managers have no balances), and the HR dashboard's removed calendar paid for its new read.
  Assert the exact count per role in `query-budget.test.ts` (`toBe(4)`), not only `<= 4`.
- **An odd last card takes the whole row below the breakpoint:** `[&>*:last-child:nth-child(odd)]:col-span-2` with `xl:...:col-span-1`, in the one helper that builds both the cards and
  their skeleton. It fixes every role's row at once (an employee's three cards had a hole at 375 and 768 px).
- **A predicate that only narrows rows an inner join already excludes cannot be proven by a data test** (the "window starts a week early" mutant survives). Say so in the retro and prove it with a timing instead of pretending the test covers it.

## Recursive read with a cycle guard and a true total (EPIC-11, the organization chart)

- **The schema only stops "managing yourself", so a loop is possible.** A recursive walk over `manager_id` carries `path uuid[]` that STARTS with the viewer
  (`array[v.id, u.id]`) and recurses with `where t.depth < 6 and not (u.id = any (t.path))`. A depth cap alone also ends a loop, but only after returning the same
  people up to six times, so the test must assert each id appears once, not only that the query returns.
- **Count before you cut.** `counted as (select count(*) from tree)` is a CTE next to `kept as (select * from tree order by depth, name, id limit 200)`, so the true
  total survives the limit. **Order the cut by depth first**: every kept person's manager is then kept too (all of depth d come before d + 1), and the tree stays connected.
- **A role gate in the read itself** (`where u.id = ${viewerId} and u.role = 'manager'`) makes a wrong call return nothing; the gated test runs it as an employee, as HR and as an
  unknown id, and also proves the right role gets data.
- **An unknown parent and a person with no reports must answer identically** (an empty page), so the route cannot be used to ask whether someone exists.
- **Mutation proof by script:** one list of (name, pattern, replacement), assert the pattern exists, run the gated file, restore from a saved copy, `cmp`. Ten mutants in under a minute.
- A new zod schema for a new route goes in its own file when the shared `schemas.ts` has a very high degree (66 importers).

## Canonical lazy tree and wide-content pattern (EPIC-11, the Organization tab)

- **A grid item is as wide as its longest word.** Below the breakpoint a plain `grid` has an auto column, so one 140-character unbroken name made a card 1,343 px wide and the page scrolled
  sideways, even with `break-words` and `[overflow-wrap:anywhere]` on the text. Use `grid-cols-1` (it is `minmax(0, 1fr)`) and switch to the real columns at `lg`. Only a long name in a
  grid layout shows it, so put one in the browser data and measure `scrollWidth <= clientWidth` with every level open.
- **Never define a component inside a component.** `function Row() {}` inside the tree is a new type on every render, so React remounts the subtree and the focused button loses focus.
  Use plain render functions (`const renderRow = (...) => <li key=...>`) and keep a source test that fails if `function List|Row` or `<List` / `<Row` returns.
- **A lazy tree's state is a pure reducer** with a ticket per request (an answer for an older request is ignored), a merge by id (offset pages can repeat someone), `collapse` that keeps what
  was loaded, and a `focusId` set after "Show more" so focus moves to the first NEW row instead of falling to `body` when the button disappears. Parse the answer defensively (anything
  not exactly the envelope is a failed expansion) and keep only the fields the page draws.
- **Native `<details>` is a free keyboard-usable tree** (Enter and Space toggle, no client code); make the whole card the `<summary>` (spans only, so it is valid inside it) and `list-none`
  plus `[&::-webkit-details-marker]:hidden` to hide the marker. Cap the indent by level so a six-level tree stays inside 320 px.
- **Prove "never shows X" with a leaky read**: feed the component objects that carry an `email` and a `reason` and assert neither is in the HTML, rather than only checking the happy data.

## Changing the seed (found in the reporting-lines change, 2026-10-20)

- **`on conflict do nothing` does not change an existing row**, so a seed change that edits a column must also carry an idempotent `update` that names the fixed ids and a "still has the old value" guard
  (`... and manager_id is not null`), or staging keeps the old data. Prove it by running the OLD seed (`git show HEAD:supabase/seed.sql`), then the NEW seed twice, on a real PostgreSQL, and comparing row counts.
- **An old fix-up update can silently undo the new data.** The "point Hana at Sam when she has no manager" update ran on every seed and would have re-attached her each time. When changing what a column
  should be, grep the seed for every `update public.<table>` and remove the ones that set the old value. A test that reads `seed.sql` and fails on any non-null assignment catches it coming back.
- **Check every SQL assertion file, not only the one named after the thing**: CI runs `verify_schema.sql` as well as `verify_seed.sql`, and the former held "Hana must have a second hr_admin as her manager".
  Search `supabase/tests/` for the names and ids you change, and run both files against the migrated database.
- **Keep the mock users and the seed in one test**: parse the seed's users insert and assert each mock user equals its row, so the two cannot drift.

## Fake Auth server for routes that call Supabase Auth (learned in TASK-065, 2026-10-20)

- **A route that needs the real sign-in path is testable without Supabase.** Put a tiny stateful HTTP server behind `NEXT_PUBLIC_SUPABASE_URL` (endpoints: `POST /auth/v1/token` for password and refresh, `GET` and `PUT /auth/v1/user`, `POST /auth/v1/logout?scope=`; HS256 JWTs with `sub`, `email`, `exp` and `session_id` are enough for `getClaims`, which falls back to `GET /user`). In a unit test, mock `createSupabaseServerClient` to return `createClient(fakeUrl, "anon", { auth: { persistSession: false } })` and assert the ORDER of calls and the state afterwards (new password signs in, old does not). In a browser run, the same server lets the real login form and the proxy run.
- **Make the fake's failure switch match method and path** (`PUT:/auth/v1/user`), because the proxy calls `GET /user` on every request and swallows a path-only switch. Do not count the harness's own `/__state` reads as calls: count writes (`POST`/`PUT`) only.
- **A password change changes the harness state:** run the width that succeeds LAST, or reset the fake, or later contexts sign in with a password that no longer works.
- **Never put the password in anything a test can read twice:** assert on the log lines, response bodies and page HTML that the typed passwords are absent, and grep the production server's own log after the run.
- **Mock vs real session:** `getSessionSource()` (same cached resolution as `getSession()`) tells them apart; features that need a real account (change password, EPIC-8's set-password) check it in the page and in the route.

## End to end for a data section without a page (learned in TASK-066, 2026-10-20)

- **Render the real server component from a gated test.** `renderToStaticMarkup(await Section(props))` with only `requireDb` and `getSession` replaced runs the real reads and the real markup on a real database, so "this person sees exactly these people" is asserted on what the page would show. Static markup includes client components' first render, which is enough for names and counts. Mock `next/navigation` (`redirect`, `unstable_rethrow`) too.
- **Count a name carefully.** A person can legitimately appear several times (summary, side card, tree). For "each person once" assert on the read's ids, not on text occurrences.
- **A streamed section is not there when `goto` resolves.** In a browser check wait for the section's "Loading…" to disappear before reading the text; three false failures came from reading too early.
- **Judge a depth-cap or paging test by its mutation.** If removing the cap or the clamp does not fail a test, the test only asserted what was present, not what must be absent or the people on the clamped page.

## HR write with a change record, and proving a lock (learned in EPIC-13, 2026-10-20)

- **Record the change in the same transaction, decide in SQL.** `setPolicyRate` takes an advisory lock, reads the actor's role, the target's role and the current value in one statement, throws `FORBIDDEN` or `NOT_FOUND` from those booleans, and writes the new value and its history row in ONE CTE statement. The route's `assertRole` is only the first gate; a gated test calls the function directly as an employee and a manager to prove the SQL refuses on its own.
- **A history table that only grows must never be joined before it is cut.** `with latest as (select ... order by changed_at desc limit 10)` first, then join the names: 1,600 rows made the plan look fine and 100,000 would not have. Read the EXPLAIN at a large size, not just the timing.
- **Prove a lock by holding it.** A race test ("two at once") passes without the lock. Open another transaction that takes the same `pg_advisory_xact_lock(hashtext(key))`, start the write, wait a moment, assert it has NOT finished and changed nothing, release, assert it completes. Export the key builder so the test and the code cannot drift.
- **Rerun-safe gated files:** prefix every name the test creates with a per-run random tag (`Pol1a2b3c4d`), or a rerun on the same database matches the last run's people and totals double.
- **Test an accrual-like job through the real job**, with dates derived from the latest ledger month, so the test works on a database that already ran it.
- **A number field cleared by script keeps its React state.** In a browser check select the text (`element.select()`) and press Backspace instead of assigning `value = ""`.
- **Do not combine request interception with a later switch-off.** Leave interception on and make the handler `continue()` when not faking.

## Editable data table for many rows (learned in EPIC-13 phase 1, 2026-10-20)

- **A CTE's order does not survive an aggregate.** `json_agg(... order by k.name)` over a CTE sorted by something else silently re-sorts. Carry the chosen order as a column (`row_number() over (order by <the CASE list>, name, id) as rn`) and aggregate `order by rn`. A gated test per sort key and direction found it; no unit test on the SQL text could.
- **Sort from a whitelist through `CASE` over bound values:** `case when ${sort} = 'vacation' and ${dir} = 'desc' then f.vacation end desc nulls last, ... , f.name, f.id`. No fragment, nothing interpolated; zod validates `sort` against a fixed list and the unit test asserts the values are bound. Put "empty last" in both directions and name then id as the last tie-break, or paging repeats and skips rows.
- **Keep the rows you edit.** After a save the server re-renders with fresh rows (to refresh tiles and history); a table that renders from the new props reorders, or drops, the row you just edited when the list is sorted by that value or filtered by it. Take the rows once into state (`const [rows] = useState(people)`), key the table by the address, and guard it with a test that the rendered rows never come from the props.
- **One state, two structures.** A responsive table and its phone cards that both hold inputs must share one state (a map keyed by row and column) and give each input its own id (`-t`, `-c`); the hidden one is `display:none`, so it is neither focusable nor read out. Assert both structures and the 2x input count.
- **Save-on-blur needs an "unchanged" check** (`isUnchanged("1.5", "1.50")`), Esc to revert, an inline error without sending, and a `role="status"` Saved that clears itself; keep these checks in a small pure module so they are unit-tested.
- **Filters that apply on change:** put the `change` handler on the form and ignore everything but `HTMLSelectElement` targets; keep the search on submit; a no-script Apply button in `<noscript>`; every change goes back to page 1. On a phone collapse the selects behind a button (closed unless a filter is applied) so the list starts on the first screen.
- **Check the layout against the real width.** The mockup's right-hand panel fitted at 1536 px with a narrow sidebar; with ours the table was cramped, so the panel moved to 1700 px. Read the screenshots, not only the checks.
- **A harness that reads `innerText` of a row gets the avatar's initials first;** select the name element. A `border` on a scroll container makes a sticky header read 1 px, so allow 1 px.
- **A browser script that throws loses its results.** Add a `process.on("uncaughtException")` that prints the checks so far.

## Server-paged approval lists (learned in EPIC-14, 2026-10-20)

- **Move a rule into SQL only with a parity test.** A manager's queue computed "over balance" in TypeScript; filtering, sorting and paging by it needs it in SQL. Keep the TypeScript rule for display, mirror it in a `CASE` (`ok`, `over`, `blocked`), and prove the two agree over a matrix of cases (untracked, no row, negative, exactly enough, 0.01 short, weekend-only), and that each status filter returns exactly the TypeScript rule's set. The decision route and the page can never disagree about who may approve.
- **A role check in SQL needs data that would otherwise pass it.** "Another team never appears" does not prove the manager-role check: an HR Admin with employees under them does (an older data shape). Create that person, with both a pending and a decided request, and assert the lists are empty.
- **Compare company-wide numbers in one snapshot.** `sql.begin("isolation level repeatable read read only", ...)` around the list read, the count read and the direct count; otherwise another gated file inserting rows between two reads makes the comparison flaky.
- **Keep a cap-free list honest:** the HR queue lost its cap of 50, so a gated test asserts its unfiltered total equals the dashboard count and the old queue's total, and a browser check pages to the last page of every waiting request.
- **Two structures, one set of buttons.** A table and its phone cards that both hold decision buttons can use the same client component in both (the decision removes the row and refreshes), unlike editable cells, which need shared state. Assert the buttons in both, from one import, and that no `fetch` is re-implemented in the table.
- **Give an actions cell a minimum width.** Two buttons side by side wrapped inside a narrow cell (56 px tall); `min-w-[17rem]` on the cell fixed it. Measure the button heights and the container's `scrollWidth` in a browser at 1280, 1440 and 1728.
- **Shared filter pieces make a third list cheap:** `FilterForm` (a select or a date applies on change, the search on submit), `SearchRow`, `CollapsibleSelects`, `FilterChips`, `Pager`, `StatTiles`, `ViewTabs`, `SortHeader`. Switching view clears the filters because their choices differ.
- **A harness that reads text from a row** should select the name element (`p.font-semibold`), not every bold span; and wait for hydration before changing a select.
