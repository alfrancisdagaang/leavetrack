# LeaveTrack — Session Handoff

Last updated: Sunday 2026-10-18 (end of session) · Code state: `origin/main` is at `06dee3f` and local `main` matches it. This
handoff edit is the only uncommitted change (commit it when the user says).
Commits 2026-10-18: `155e9df` (TASK-027: staging rollout runbook, demo checklist, four demo requests in the seed), `06dee3f`
(EPIC-2 tasks marked Done, handoff). 2026-10-17: `517ce12` (page-load reliability: streamed sections and one retry of reads),
`bababb5` (TASK-025: httpOnly and Secure session cookie, wider log redaction). Session 2026-10-16: `5f49aaf` (TASK-020 + 021),
`35a734b` (TASK-022), `50a74d5` (TASK-024), `6cda7f3` (outage handling and query logging), `169bbcc` (deadlines on Auth calls and queries).

**Read first, 2026-10-18 end of session:** the demo is **Mon 2026-10-19**. Staging is in demo state (TASK-027 done, mock login off,
reported by the user). The open threads are in section "What was done on 2026-10-18 (later)" below: the Figma MCP just added on
this laptop, the Request Leave redesign, the missing Upcoming leave and Recent activity sections, and the icon 304 finding.

A living note for starting a new session without chat history. Update it at the end of each session.
Everything below is either **verified** (checked by me on the date above), **reported** (the user told me; I did not see it),
or explicitly marked as a **decision**, **lean** (a recommendation, not agreed), or **unknown**.

**Suggested opening prompt for the next session:**

> Read AGENTS.md, knowledge/HANDOFF.md and the newest retros in knowledge/retros/, then run git log and git status.
> Tell me the current state in a few lines and what's next. Don't start any work yet.

**Suggested closing prompt for each session:**

> Update knowledge/HANDOFF.md for this session. Re-verify the repo state (git log, git status, tests), record what
> changed, which decisions I made, what's still open, and what to do next. Show me the diff and wait for my approval.
> Don't commit.

---

## 0. Deadline and demo plan (read this first)

- **Demo: Monday 2026-10-19.** The user must show their supervisor an **online** system. The user works alone as far as we
  know (unconfirmed) and can work weekends. Days left after today: Fri 10-16 to Mon 10-19 morning.
- **The user said real sign-in is expected on Monday** (2026-10-15). It is not in the original PRD; it is now US-09 / EPIC-2.
  **Status 2026-10-16: real sign-in is built and works** (TASK-020, 021, 022, 024 all validated; live checks below).
  **Status 2026-10-17:** the staging **stall problem** (section 0a) is **mitigated** (page-load reliability, `517ce12`) and the
  user **reports no stuck loading** on the deployment. The cause is still **unproven**; watch the logs (section 0a). If pages
  start hanging again, demo the labelled mock fallback and say so plainly.
  **Status 2026-10-17 (later): TASK-025 is built, validated and pushed (`bababb5`).** The Supabase session cookie was NOT
  httpOnly or Secure (library default); it is now. Live check **partly reported**: after signing in the user typed
  `document.cookie` in DevTools and got `''` (the `sb-*-auth-token` cookie is hidden from scripts). **Not reported:** the Cookies
  table (HttpOnly, Secure, SameSite) and whether the Console shows any CSP error. Ask for both, then mark the retro verified.
  **Status 2026-10-18: TASK-027 staging rollout done by the user (reported, not seen by me).** Per `knowledge/runbooks/staging-rollout.md`
  and `demo-checklist.md` steps 1 to 7 the user reports all good: `seed.sql` re-run on staging (adds 4 pending requests), sign-ups off,
  Site URL set, **`ALLOW_MOCK_LOGIN` off on Vercel (AC4)** and redeployed, and sign-in works **without the mock login**. The user did not give
  per-item detail, so these stay **unconfirmed**: the exact Cookies flags (HttpOnly, Secure, SameSite) and Console CSP result (TASK-025),
  and the per-role results (Marco never sees Leo, "not set up" account). Ask only if the supervisor questions them. Decision 2026-10-18:
  mock login OFF for the demo; rollback is `ALLOW_MOCK_LOGIN=true` plus a redeploy (runbook). Retro `2026-10-18-task-027-staging-rollout.md`.
- **Supervisor's original scope:** US-01 to US-08 (EPIC-1). All built; TASK-016 (mobile pass) is the only EPIC-1 task still `Open`.
- **UI approach:** the Figma dashboard design (file `GrKk5YyfJcDRdPBr7xXTF9`, now six frames: Manager desktop 14:8878, Manager
  mobile 14:9401, Account dropdown 14:9931, Mobile drawer 14:9698, Collapsed rail 14:9981, Navigation by role 14:9946) is the
  basis. Request Leave, My Balance and Team Approvals **have no Figma yet; the user will send a link**. Until then those pages
  use the restyled shared components (Card, Button, PageHeader, fields) on the dashboard tokens.
- **"Online" means GitHub + Supabase (staging) + Vercel.** The demo uses fake data only and the URL is access-restricted
  (Vercel Deployment Protection).
- **Accounts and deployment** (unchanged from 2026-10-14; **reported**, not verified by me):
  - GitHub: private repo `alfrancisdagaang/leavetrack`. `gh` is not installed, so **I cannot see CI runs**; the user checks
    GitHub Actions on the website. I have not seen CI for any commit after `ae16ed6`.
  - Supabase: project `staging`, region ap-south-1 (Mumbai). Migrations reach it through the CI `db-push` job (GitHub
    **`production` Environment** secret `SUPABASE_DB_URL`, Session pooler string). Staging was seeded by the user with
    `supabase/seed.sql` (7 fake users, balances, 3 pending demo requests). Accrual was run once manually (Elena Vacation 10 to 11.25).
  - Vercel: Hobby plan, Deployment Protection on, `vercel.json` sets `"regions": ["bom1"]`. Env vars: `APP_ENV=staging`,
    `DATABASE_URL` (Transaction pooler, port 6543), `CRON_SECRET`. `DIRECT_URL` deliberately unset. The runtime log line
    "Routed to ... bom1" has **never been confirmed by me**.
  - **Vercel env vars added 2026-10-16 (reported by the user):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    `ALLOW_MOCK_LOGIN=true` (**temporary: remove it or set it false, then redeploy, before the supervisor demo**). Still unset:
    optional `APP_TIMEZONE` (for example `Asia/Manila`; the calendar's "today" uses UTC when unset).
  - **Supabase Auth (2026-10-16):** seven Auth accounts exist for the seven seeded emails (created by `npm run auth:seed` in the
    user's own shell; shared demo password chosen by the user, never in chat). **"Allow new users to sign up" was still ON
    at the last check and the Site URL was not confirmed set: both are the user's to do** (Authentication, Sign In / Providers).
  - Passwords, keys and connection strings were never committed. Never paste them into chat.
  - **Database password changed 2026-10-17 (reported by the user).** A stale copy caused two outages that looked like code bugs:
    Vercel `DATABASE_URL` (`28P01`, shown to the user as React **#441**) and the GitHub `db-push` job (`SUPABASE_DB_URL`).
    The user fixed both. The password now lives in **four** places: Vercel `DATABASE_URL` (Transaction pooler, 6543), GitHub
    `SUPABASE_DB_URL` (Session pooler, 5432; check the **production Environment** secret, it overrides a repo-level one), the
    local `.env.local`, and any other local copy. Rotate all of them together. URL-encode special characters.
  - **Shared demo password reset 2026-10-17 (reported).** The user could not sign in as `elena.cruz@leavetrack.example` on live
    or locally: the shared password was not the one the accounts had. They re-ran `npm run auth:seed -- --yes` in their own
    shell with a new `DEMO_PASSWORD`, which reset all seven accounts, and sign-in then worked. **The new password lives only
    with the user** (never in chat or the repo): they should keep it in a password manager and give it to demo attendees directly.

### Plan (remaining)

| Day               | Work                                                                                                                                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fri 10-16**     | Done: TASK-020, 021, 022, 024 (real sign-in), stall diagnosis and two resilience fixes (section 0a). Pushed.                                                                                                                                                                        |
| **Sat-Sun 10-18** | Done Sat: page-load reliability, deployed, user reports no stuck loading. TASK-025 security review done and pushed (live check partly reported). Left: TASK-027 staging rollout (sign-ups off, Site URL, mock off), click-through as each role on the live URL, demo script, buffer |
| **Mon 10-19 am**  | Rehearse (from the network you will demo on), then demo                                                                                                                                                                                                                             |

If time runs short, cut in this order: change-password page (TASK-026), polish, request detail page and cancel, extra features.
The core loop (US-01 to US-05), accrual, the sidebar shell, the cards and the calendar are done.

### 0a. Staging stall problem (mitigated 2026-10-17; cause still unproven)

**Update 2026-10-17.** Evidence and result, newest first:

- **Result (reported by the user):** after `517ce12` deployed, "no stuck loading in pages". I did not see the Vercel logs.
  **Which change helped is unknown** (the retry, the shorter connection lifetimes, the streaming, or fewer queries).
- **A new log line (reported):** `query: "balance.last_accrual"`, `ms: 8000`, `deadlineMs: 8000`. That query is
  `select max(period) from accrual_ledger` on a tiny table, run in parallel with `balance.summary`, which finished. A slow query
  would not do that; a stuck pooled connection would (candidate 1 below). Still not reproducible locally.
- **A separate cause, not the stall:** Vercel's `DATABASE_URL` had a stale password (`28P01`, 525 ms), which made Request Leave
  crash with React #441 ("error in the Server Components render, message omitted in production"; verified in React's
  `codes.json`). Fixed by the user in the Vercel variable, no code involved.
- **Found by reading the code:** `getMySummary` runs 4 queries but the dashboard and Request Leave used only the balances
  (one wasted query and a 50-row fetch each); a manager's dashboard issued up to about 7 queries against a pool of `max: 5`;
  Request Leave and My balance had no `try/catch`, so any read failure became the error page. (I wrongly said earlier that layout
  and page make two Auth calls: `getSession()` is wrapped in React `cache`, so it is one.)
- **Done (`517ce12`, retro `2026-10-17-page-load-reliability.md`):** `timedRead` (3 s first attempt, one retry on a deadline or a
  lost connection, 8 s total, reads only), `idle_timeout` 10 and `max_lifetime` 300 (pool still `max: 5`), `getBalanceSummary`,
  dashboard / Request Leave / My balance rendered as a header plus `<Suspense>` sections with per-section failure fallbacks,
  `prefetch={false}` on the dashboard's links, all read paths (pages, `session.find_user`, read API routes) on `timedRead`.
  The optional `staleTimes` client cache was **left out** (stale approvals and balances on the demo screens; sign-out risk).
- **Verified locally:** against a TCP black hole as the database, first byte in 21-79 ms, pages degrade with messages, each read
  retried once (3 s, then 5 s left), 8 s total. A retry that _succeeds_ is only unit-tested.
- **How to tell it is working on Vercel:** `Database query hit its deadline` should become rare and `Retrying read query`
  (with `attempt: 2`) should appear instead. If `balance.last_accrual` still hits 8 s every time, it is not a dead connection.

**Original write-up, 2026-10-16:**

**Symptom (reported by the user, live on `leavetrack-seven.vercel.app`):** the dashboard sometimes stays on its loading skeleton,
worst after navigating to other pages and back ("other pages are fast, the dashboard sticks; a refresh fixes it"); manager and
HR are worse than employee; sometimes other pages stick too. **Root cause is NOT proven.**

**Evidence (reported by the user from Vercel, Supabase or the browser; I did not see those dashboards):**

- Browser console: React error **#412 = "Connection closed"** (I looked it up in React's `codes.json`): the streamed response was
  cut off while Vercel logged 200.
- Vercel: `Session resolution failed; treating as signed out`, then `canceling statement due to statement timeout` (Postgres
  `57014`, raised by the server, so the connection was alive at that moment); later **`Task timed out after 300 seconds`**
  (a request that never answered; not a slow query).
- After `169bbcc` deployed, a log line appeared: **`query: "dashboard.calendar"`, `ms: 8001`, `deadlineMs: 8000`,
  "Database query hit its deadline"**, and the card fell back to "calendar unavailable". Only that one of the three parallel
  queries stalled; the user lookup and balances completed.
- **The calendar query is not slow:** `EXPLAIN (ANALYZE)` in the Supabase SQL Editor (direct connection, not the pooler) ran in
  **0.29 ms**, 3 rows, index scans. Tables are tiny (KB). Supabase CPU and disk IO are low; network spikes are KB; region matches
  (Supabase ap-south-1 and Vercel bom1, both Mumbai). Free-tier nano starvation was therefore **dropped** as the cause.
- Separate and not the app: from the user's own PC, one request spent **10 s opening the TCP connection** to Vercel (before any of
  our code), then 7 later requests to both Vercel IPs took about 0.3 s. A transient route problem on the user's network; the
  browser message "site can't be reached" has no Vercel log because the request never arrived. **Test the demo from the network
  you will demo on.**
- Not a cause: the `304` on `/icons/*.svg` (harmless cache revalidation).

**Ranked candidates (unproven):** (1) a half-dead pooled Postgres connection reused after Vercel froze the function (one of three
parallel queries lands on it and waits); (2) the same for the Auth HTTP call (`getUser` / proxy `getClaims`; supabase-js has no
timeout and retries a failed refresh with backoff); (3) pooler queueing from many instances or prefetch bursts; (4) a lock
(unlikely: the server would cancel it); (5) a rendering or streaming bug.

**Why the dashboard is worst:** it runs the calendar query plus up to three parallel queries, and every page is fully dynamic (no
caching, by design: the session cookie and per-person data), so each click re-runs the Auth check, the user lookup and the
queries. Link prefetch (calendar buttons, "New request", logo) may add background requests: **unchecked**; ask the user to look in
Vercel Logs for a burst of `?_rsc=` requests right after opening the dashboard.

**What was done about it (pushed):**

- `6cda7f3`: `getSession()` throws `SERVICE_UNAVAILABLE` (503) when the database or Auth server cannot be reached, instead of
  returning `null` (which looked like a sign-out); `/login` still shows the form then; `timedQuery` (`src/lib/db/timed.ts`) logs
  name, duration and Postgres code (never SQL or values); sidebar links use `prefetch={false}`. Retro `2026-10-16-page-load-resilience.md`.
- `169bbcc`: Auth calls get a 5 s deadline (`fetchWithDeadline` per fetch plus `withDeadline` for the whole call, because supabase-js
  retries a failed refresh: a per-fetch deadline alone left a local black-hole test at 33 s+); queries on read paths get an 8 s
  deadline (`QUERY_DEADLINE_MS`) and fail with 503, named in the log; the proxy lets pages through to re-check when the Auth check
  could not complete (never grants a session) and answers `/api/*` with a 503 envelope; `maxDuration` 30 s for the app and API routes,
  60 s for the cron route. Local hang smoke: API 503 in 5 s, dashboard error page in about 10 s, mock sign-in unaffected.
  Retro `2026-10-16-hang-protection.md`. **These bound and name a hang; they do not prove the cause.**
- **Rejected on evidence:** shrinking the pool. Against an unreachable database on `next dev` (first employee dashboard request):
  `max: 5` 0.5 s, `max: 3` 7 s, `max: 1` 40 s, because fewer connections serialise the dashboard's parallel queries. The pool stays
  `max: 5`, `idle_timeout: 20`.

**Proposed next task, "dashboard reliability" (DONE 2026-10-17 as "page-load reliability", `517ce12`; kept for history):**

1. `prefetch={false}` on the dashboard's own links (previous, today, next month, "New request", logo).
2. Retry a read query once on a fresh connection when it hits its deadline, with a shorter first deadline (about 3 s; healthy queries
   take milliseconds), so a dead connection costs about 3 s instead of a failure.
3. Close idle connections sooner (`idle_timeout`, `max_lifetime` on the Postgres client).
4. **Open decision for the user:** include the optional client cache `experimental.staleTimes.dynamic: 30` (Next docs: experimental;
   reuses a page visited in the last 30 s, so going back to the dashboard is instant; costs up to 30 s of stale data; per-browser
   only). Check that sign-out clears it. The safer default for the demo is to leave it out; the user had not answered.

Tests with fake timers; writes stay unwrapped. After deploy, read the logs for `Deadline exceeded` (`stage: auth.get_user` or
`proxy.get_claims`), `Database query hit its deadline` (`query: <name>`), `Slow database query`.

**Still unverified:** that the stall is fixed (not reproducible locally); that `npm run build` passes on `6cda7f3` and `169bbcc`
(port 3000 was held by the user's own server, so I did not build; the Vercel deployment evidently built, since its new log lines
appeared); GitHub Actions for the last five commits (`gh` is not installed).

### What was done on 2026-10-18 (later; verified by me unless marked)

- **TASK-027 done** (`155e9df`, `06dee3f`, pushed): `knowledge/runbooks/staging-rollout.md`, `demo-checklist.md`, retro
  `2026-10-18-task-027-staging-rollout.md`, four pending demo requests in `supabase/seed.sql`. I verified on an in-memory Postgres
  (pglite in the scratchpad; no local Postgres on this Mac): migrations plus the seed twice are idempotent, queues scope correctly (Marco
  gets Elena and Jun, never Leo), the auth-seed parser still reads 7 emails. The live steps are **reported** by the user: seed run on
  staging, sign-ups off, Site URL set, **`ALLOW_MOCK_LOGIN` off**, sign-in works without the mock login. Per-item detail (cookie flags,
  CSP console, per-role results) was not given: unconfirmed. Rollback: `ALLOW_MOCK_LOGIN=true` plus redeploy.
- **EPIC-2 CSV:** TASK-020 to 025 and 027 are `Done` (the user asked, "mark done with the epic-2"); **TASK-026 stays `Open`**; the EPIC-2
  header row stays `Open`.
- **Icon 304 evaluated; the user chose to leave it (decision).** Verified with `curl` on the live URL: `/icons/*.svg` goes through
  `src/proxy.ts` (the matcher only skips `_next/static`, `_next/image`, `favicon.ico`, `robots.txt`), so signed out it answers 307 to
  `/login`, and signed in every icon costs an Auth check; Vercel serves `public/` files with `max-age=0, must-revalidate`, hence the
  304s. Harmless for security and function. **Possible contributor to the stalls (unproven; Auth call is candidate 2 in section 0a).**
  Fix if wanted after the demo (option B): exclude `icons/` in the matcher, `Cache-Control: public, max-age=86400` for `/icons/:path*`
  in `next.config.ts`, add `src/app/icon.svg` (the `/favicon.ico` 404), tests for matcher and header. Not logged in a retro (user said
  not to bother). If a page hangs in the demo, look at this first.
- **Request Leave redesign (discussed, nothing built).** Current form: `src/app/(app)/requests/new/request-form.tsx` (leave-type select,
  two dates, working-days line, reason, over-balance warning, success alert). Proposed, frontend-only (no API or DB change): selectable
  leave-type **cards** (Vacation, Sick, Unpaid "Untracked") showing available and pending days, doubling as the picker (radio group);
  a live summary panel (readable dates, working days, balance after); friendly field errors and a 500-character counter; a richer
  success screen; mobile stacking with a sticky Submit; desktop two columns. **Needs a decision, not designed:** block past dates,
  overlap warning, approver name, half-days (no), attachments (no). I wrote a full Figma prompt for this (not saved in the repo; regenerate
  it from this list: tokens from `globals.css`, 10 states, desktop 1440 and mobile 375). The user's first Figma run failed because it
  ran in a **different Figma account** that could not see the dashboard file.
- **Upcoming leave and Recent activity (dashboard, in the Figma, not built, no PRD story).** The user pointed out both are missing
  from the dashboard. My proposal (a **lean**, not agreed): same role scope as the calendar (employee own, manager own plus direct reports
  by `u.manager_id`, HR everyone), Upcoming = `leave_requests` with `end_date >= today`, not deleted, **include pending with a chip**
  (the demo data is nearly all pending, so approved-only would be empty), about 5 rows; Recent activity = `audit_log` joined to the
  request and people (submitted, approved, rejected; no cancel yet), scoped in SQL, relative time. No migration. Each is about 1 to 2
  hours with tests, streamed with `timedRead` per the dashboard pattern. **Decisions the user has not answered:** pending in
  Upcoming, role scope, time format, row links (no detail page exists, so none), and writing PRD US-11 plus two CSV tasks first.
  **I have not seen those two sections in Figma** (no Figma access in this session).
- **Figma MCP (this is a new laptop).** The user ran `claude mcp add --transport http --scope user figma https://mcp.figma.com/mcp`
  (saved in `~/.claude.json`, **not** in the repo; the project `.mcp.json` is untouched). `/mcp` did not list it yet because Claude Code
  reads servers at startup. **Next session:** restart, `/mcp`, select figma, Authenticate with the Figma account that can open the
  file (it must be able to see it; share the file if not), then use the link the user sent:
  `https://www.figma.com/design/GrKk5YyfJcDRdPBr7xXTF9/Untitled?node-id=0-1`. Fallback if the MCP will not connect: export the frames as
  PNGs into `docs/designs/dashboard/` (the tool can read images). The older Figma notes (file id, frame ids, asset URLs expire after 7
  days) are in "Machine and tooling notes".
- **Suggested order for the next session:** (1) Figma MCP works, (2) read the Upcoming leave and Recent activity frames and settle the
  five decisions, (3) PRD US-11 plus tasks, then `/evaluate`, (4) Request Leave redesign once its design exists, (5) TASK-016 mobile
  pass if there is time. Rehearse the demo script before anything else, from the network the demo will use. Do not touch `proxy.ts`
  the night before the demo.

### What was done on 2026-10-17 (verified by me unless marked)

- **Machine changed:** this session ran on **macOS** (zsh), not the Windows machine of earlier sessions. `.env.local` did not exist
  here; the user created and filled it (`DATABASE_URL` and the two `NEXT_PUBLIC_SUPABASE_*` values, **reported**; I only saw
  which keys were empty, never the values). Presumably it points at the staging pooler; I did not see it. No local Postgres was
  set up on this Mac.
- **graphify:** a full `/graphify .` rebuild was started, then **discarded** at the user's choice: graphify's shrink guard refused
  to overwrite the existing graph (877 new nodes vs 1071; the old graph had about 400 finer-grained document nodes). Installed the
  SQL extra (`uv tool install "graphifyy[sql]" --force`); the SQL migrations were already in the graph. `graphify-out/` is
  unchanged. A plain `--update` flagged all 201 files as changed (the manifest did not match), so only the SQL files were
  re-extracted by hand; they came out identical, and the original `graph.json` was restored.
- **Page-load reliability** (`517ce12`, pushed): see section 0a. 27 files; `timedRead`, streamed sections, retro and pattern
  (`knowledge/patterns/implement-and-test.md`, "Canonical data-page pattern"). Tests 352 passed, 14 skipped; `lint`,
  `format:check`, `typecheck` clean; `npm run build` passed **in a throwaway copy** (the user's `next start` held port 3000).
- **GitHub Actions `db-push` failed with `28P01`** after the push: the `SUPABASE_DB_URL` secret still had the old database
  password. The push had no migrations, so nothing was skipped. The user updated the secret (Session pooler, port 5432) and
  re-ran the job; **reported fixed**.
- **TASK-025 CSP and security review** (`bababb5`, pushed; retro `2026-10-17-task-025-csp-and-security-review.md`):
  - **AC2 was a real gap.** `@supabase/ssr` 0.12.7 defaults to `httpOnly: false` and no `Secure`, and both clients passed its
    options through, so the `sb-*-auth-token` cookie was readable by page scripts (ADR-E003 had claimed httpOnly). Fixed with
    `src/lib/supabase/cookie-options.ts` (`supabaseCookieOptions`, `isSecureCookie`) passed as `cookieOptions` in
    `src/lib/supabase/server.ts` and `proxy.ts`. Proved with the **real library against a fake Auth server**: before
    `httpOnly=false secure=undefined`, after `httpOnly=true secure=true sameSite=lax`.
  - The old proxy test stub wrote `{ httpOnly: true }` itself and hid the default; it now asserts what the proxy asks for.
  - **AC3:** the logger's redact list only matched `*.password` and `*.token` one level down. `REDACT_PATHS` (exported) now covers
    password, token, access_token, refresh_token, cookie, authorization at top level and one level down. New guard tests
    (`security-guards.test.ts`: no service-role identifier in `src`, no secret-named `NEXT_PUBLIC_` variable, no secret-like log
    field) were proved to fail on a planted violation.
  - **AC1:** `connect-src 'self'` is unchanged on purpose (no browser Supabase client; every Auth call is server-side). A comment
    in `next.config.ts` says so. Production build + headless Chrome: mock sign-in to `/dashboard` with no CSP violation; the
    only console error was a `404` for `/favicon.ico`. A real Supabase sign-in could not be driven by me (shared password).
  - Docs: ADR-E003 update (the cookie is httpOnly only because we override the default), two coding-standards rules, a pattern.
- **Sign-in debugging tip:** the login form shows "Incorrect email or password." for three Supabase errors, `invalid_credentials`,
  `user_not_found` and `email_not_confirmed`, on purpose. The real reason is in Supabase, Logs, Auth. Nothing is logged by the app
  for these. A wrong Supabase URL or anon key shows a different message ("unavailable").
- **Not done:** the AGENTS.md "MOCK AUTH" banner reword (asked, no answer), TASK-027, the polish batch, the favicon.

### What was done on 2026-10-16 (verified by me unless marked)

- **TASK-020** Supabase clients, env, session resolution (`5f49aaf`): pinned `@supabase/ssr` 0.12.7 and `@supabase/supabase-js`
  2.118.0; `src/lib/env.ts` gained the two `NEXT_PUBLIC_SUPABASE_*` vars (required when `APP_ENV=production`) and `ALLOW_MOCK_LOGIN`
  (unset = true in development, false elsewhere); `src/lib/supabase/server.ts`, `src/lib/auth/users.ts` (`findUserByEmail`,
  `lower(email)` in SQL); `getSession()` asks Supabase first (`getUser()`), then the mock cookie only if the flag is on; fails closed.
- **TASK-021** proxy (`5f49aaf`): `src/proxy.ts` async, `src/lib/supabase/proxy.ts` (`getClaims()`, refreshed cookies copied onto
  pass, redirect and 401 responses); stale mock cookie cleared when the flag is off; `/login` redirects signed-in people via
  `safeNextPath()`. **Bug found and fixed:** the `catch` in `getSession()` swallowed Next's `DYNAMIC_SERVER_USAGE`; now
  `unstable_rethrow(err)` first (rule added to `knowledge/rules/coding-standards.md`). AC2 was PARTIAL (mock-proved); the user
  chose option A (mocks now, real test with TASK-022), which the live check below then covered.
- **TASK-022** login form and actions (`35a734b`): email and password via `signInWithPassword`; one generic wrong-credentials message,
  "not set up" (signs out again), "unavailable"; labelled mock card only when the flag is on; `logoutAction` signs out of Supabase.
  **Live check (user-driven, local dev with one hand-made Auth user):** signed in as Elena, dashboard, reload, sign out, sign in again,
  wrong password. 5/5 AC PASS. Proxy first call about 206 ms, then 7 to 11 ms (suggests asymmetric signing keys; evidence, not proof).
- **TASK-024** seeding script (`50a74d5`): `npm run auth:seed` (`scripts/seed-auth-users.ts` and `.lib.ts`, runbook
  `knowledge/runbooks/seed-auth-users.md`). Dry run by default, `--yes` writes, optional sign-in check per user with the anon key. Reads
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_PASSWORD`, optional `SUPABASE_ANON_KEY` from the user's **own shell only** (a
  documented exception to AGENTS.md rule 9). **Live run by the user:** first `--yes` 6 created, 1 updated (Elena), 7 of 7 sign-in ok;
  second `--yes` 0 created, 7 updated, 7 of 7 sign-in ok. AC1 to AC3 PASS. Needed `allowImportingTsExtensions` in `tsconfig.json`
  and the `scripts/**` glob in `vitest.config.mts`. PowerShell tip: values must be quoted (`$env:SUPABASE_URL = "https://..."`).
- Stall investigation and two resilience fixes: section 0a.
- **Corrections:** I first proposed a stale-socket theory, retracted it after the `57014` detail, and re-adopted it as the top
  suspect after the 300 s timeout (the two events differ). I measured before shipping the pool change and dropped it. I gated every
  build on the port check and skipped builds when port 3000 was busy.

### What was done on 2026-10-15 (all verified in this session unless marked)

- **TASK-018** (leave-type independence): tests only, committed (`18e2efb`), CSV status `Done`. Retro
  `2026-10-15-task-018-leave-type-independence.md`. Includes the first **gated real-database tests** (skipped unless
  `TEST_DATABASE_URL` is set; passed 2/2 on a throwaway DB).
- **Shared UI restyle** (committed, `0e9200c`): Card, Button, PageHeader, fields, Badge, Alert, skeleton and page bodies moved to
  the dashboard tokens; `ink-muted` darkened to `#5b6c86` for 4.5:1. Retro `2026-10-15-shared-ui-restyle.md`.
- **Sign-in docs** (committed, `d97baa7`): PRD **US-09**, **ADR-LeaveTrack-E003** (Supabase Auth, email and password), ARCH auth
  update, and `docs/dev-tasks/epic-2-authentication-tasks.csv` (EPIC-2, TASK-020 to TASK-027, all `Open` in the CSV). (Sign-in code was built on 2026-10-16.)
- **Sidebar shell + dashboard cards** (committed, `4c7cc9f`): left sidebar (collapsible on desktop, drawer below `lg`), slim top bar,
  account dropdown (name, role, email, Sign out), welcome block and four summary cards. This is the reworded **TASK-023**
  (still `Open` in the CSV; the user has not asked to mark it `Done`). Retro `2026-10-15-sidebar-shell-dashboard-cards.md`.
- **Dashboard calendar** (committed, `4c7cc9f`): month calendar scoped by role, from Figma. This is **TASK-030 / US-10** in the new
  `docs/dev-tasks/epic-3-dashboard-tasks.csv` (`Open`). Retro `2026-10-15-dashboard-calendar.md`.
- Docs committed in `1b0eb06`: PRD **US-10**, `epic-3-dashboard-tasks.csv`, the reworded TASK-023 row, retros.
- **Slip, 2026-10-15 (late):** I ran `npm run build` while the user's `next start` was listening on port 3000 (PID 24012), without
  gating the command on the port check. The build passed, but it replaced `.next` under the user's server. The user must stop
  it and run `npm start` again. (Same mistake as 2026-10-14; the memory note about dev servers is the rule to follow: **check
  the port in the same step, and do not build if anything listens on 3000**.)

### Progress

- [x] **Page-load reliability** (2026-10-17, `517ce12`): streamed sections, `timedRead`, shorter connection lifetimes. The user
      reports no stuck loading on the deployment; the cause is unproven (section 0a).
- [x] EPIC-1: TASK-010 to TASK-015, TASK-017, TASK-018 (`Done`) · [ ] **TASK-016** mobile pass (`Open`: the dashboard, request
      form and balance were measured; approvals and audit were not)
- [x] UI foundation, restyle, sidebar shell and cards, calendar (committed and pushed)
- [x] **EPIC-2 sign-in:** TASK-020, 021, 022, 023, 024, 025, **027** are `Done` in the CSV (marked 2026-10-18 at the user's request;
      027's live steps are reported by the user, see section 0). Remaining: **026** (voluntary change-password, `Open`, first to cut).
- [ ] **EPIC-3 dashboard:** TASK-030 calendar built (`Open` until the user asks). Not built: upcoming leave, recent activity,
      request detail page (`/requests/[id]`), the other Figma pages.

### Next session: do these in order

0. **Servers and state.** `origin/main` is at `06dee3f` (2026-10-18); only a handoff edit may be uncommitted (commit and push when the
   user says). Check the port before any build and never build while something listens on
   3000 (the user's `next start` did, PID 10269 at the last check): build in a throwaway copy instead (copy the repo without
   `node_modules`, `.next`, `.git` and `.env*`, clone `node_modules` with `cp -Rc`, build there). The Postgres 18 on port 54329
   belonged to the old Windows machine. Ask the user what the Vercel logs and GitHub Actions show.
1. **Watch the stall (section 0a).** Ask the user for the Vercel log lines after the deploy: `Retrying read query`,
   `Database query hit its deadline`, `Slow database query`, and whether `?_rsc=` bursts remain. No new code unless it recurs.
   Do not shrink the pool.
   **Backlog from this task:** `session.find_user` still runs before the shell (a stalled lookup delays the first byte by up to
   8 s, about 3 s with the retry); with the database fully down each page still takes about 8 s to finish; approvals and audit
   only got the retry, not streaming; `28P01` still shows the generic error page (fold into the polish batch, item 5).
2. **User's own steps before Monday (I cannot do them):** switch off "Allow new users to sign up" and set the Site URL in Supabase;
   remove `ALLOW_MOCK_LOGIN` (or set false) on Vercel and redeploy; rotate the `.mcp.json` key; click through as each of the seven
   users on the live URL (with the shared password, reset 2026-10-17 and known only to the user); optionally set `APP_TIMEZONE`. Whenever the database password changes, update all four
   places (section 0, Accounts).
3. **Remaining live checks not done:** the "not set up" account against real Supabase (an Auth user with a non-seed email), rate-limit
   and `email_not_confirmed` codes, token refresh after about an hour, the 503 path against a real outage.
4. **TASK-027** (rollout and demo script, High, depends on 022, 024, 025 which are done) is next. Mine to do: the runbook and demo
   script; a few idempotent demo requests in `supabase/seed.sql` (the user runs it against staging); a click-through checklist, one
   item per AC (each role sees only its own data; Marco never sees Leo's request; an email with no `users` row gets no session;
   record the staging `ALLOW_MOCK_LOGIN` value here). The click-through itself and the Supabase and Vercel switches are the
   user's. First ask for the two unreported TASK-025 checks (Cookies table flags, Console CSP errors). **TASK-026** only if time allows.
   **TASK-025 backlog:** `/favicon.ico` returns 404 (one console error on every page; add `src/app/icon.svg`); `script-src` still
   has `'unsafe-inline'` (nonce CSP is backlog); session length is the Supabase project's JWT and refresh settings, not this app
   (cookie `maxAge` is the library's 400 days; the mock cookie is 8 h).
5. **Polish batch** (the user agreed to items 1 to 5): readable dates (still ISO on balance, approvals and audit), friendly validation
   messages (raw zod paths), login page look and wording, the casing mismatch between nav labels and page titles; a dedicated
   "temporarily unavailable" error page (today the generic one shows, status 500); the login form resets the email after an error.
6. **Request detail page `/requests/[id]`** (a page, not a popup): status, who approved or cancelled, when, from `audit_log`; link
   the calendar bars and "My requests" rows. Then **cancel**: soft-delete plus a `soft_deleted` audit row in one transaction, own
   pending only, through a route handler. Needs a PRD story first.
7. **Rest of the Figma dashboard:** upcoming leave, recent activity; then Request Leave, My Balance and Team Approvals once the user
   sends the Figma link. **Manager team view and HR "manage managers" view** need PRD stories first.
8. **TASK-016** mobile re-measure; **demo prep** (section 3). Offered, not done: extend `supabase/seed.sql` with a few idempotent demo
   requests so the staging calendar is not nearly empty.
9. **AGENTS.md "MOCK AUTH" banner is now wrong** (real sign-in exists; it still says login accepts any input): reword with the
   user's OK (asked on 2026-10-17, not answered; do not edit AGENTS.md without it).

### Sign-in design (decided with the user on 2026-10-15; **built 2026-10-16**; see ADR-LeaveTrack-E003)

```
setup (user)   disable sign-ups in Supabase; run the seed script (service-role key from env, shared demo password) once
sign in        /login (email + password) -> Supabase Auth -> httpOnly session cookies -> /dashboard
every request  proxy.ts validates the Supabase session -> getSession() looks up users by lower(email) in SQL
               -> { role, user } (same shape as today); no users row = no session, "account not set up"
sign out       Supabase signOut + clear cookies
mock fallback  only when ALLOW_MOCK_LOGIN is true, clearly labelled; with it off the mock-role cookie grants nothing
```

- The demo accounts are the **seven fake `@leavetrack.example` users** with one shared password the user chooses and hands over
  directly. No email is sent (Supabase's built-in mail is rate-limited and custom SMTP is not set up).
- **Not in scope for Monday:** HR creating users on screen, forced password change at first sign-in, emailed invites, deactivating
  users, "forgot password". A voluntary change-password page (TASK-026) is the first thing to cut.
- If `ALLOW_MOCK_LOGIN` stays on at the public URL, anyone with the URL can still pick a role; switch it off after the demo.
- ADR-LeaveTrack-E001's "only the cookie origin changes" was incomplete: `getSession()` keeps its shape but `proxy.ts` and the
  login action change too (written down in E003).

### Dashboard decisions (agreed with the user on 2026-10-15)

- **Sidebar replaces the top bar;** nav labels follow Figma ("Request Leave", "My Balance", "Team Approvals", "Audit History");
  the collapsed state is not remembered; the pending-approvals card is for managers and HR only.
- **Calendar scope:** employee sees their own requests; manager sees their own plus direct reports (SQL `u.manager_id`); **HR
  sees everyone**. Rejected requests are hidden unless the switch is on (`?rejected=1`). Month and switch live in the URL.
- **Details are a page,** not a popup. Calendar bars have no link until that page exists.
- **Cancel** (the user wants it, "who cancelled it" in the details): soft-delete, own pending only (lean, matches the docs).

### Ideas still to discuss

- Employee "My requests" navigation with a status filter; manager filters and a longer decided history; HR audit presets
  (today, a range, all, per employee) and CSV export; the login page look.
- **Parked (2026-10-16): emailed invites and "forgot password" through Supabase Auth.** Flow: an HR-only route handler creates the
  `users` row (plus an `audit_log` row) and calls `auth.admin.inviteUserByEmail(email, { redirectTo })`; the invitee's link lands
  on a new `/auth/confirm` route that verifies the token (`verifyOtp`) and sets the session; then a "Set your password" page
  (`auth.updateUser`, shared with TASK-026) and the dashboard. Recovery reuses the same route and page. **Needs:** custom SMTP
  (Supabase's built-in sender is rate-limited and, as far as I know, only delivers to team members), real email addresses (the
  seed's `@leavetrack.example` can never receive mail), the **service-role key on the server** (reverses ADR-E003's "never an app
  variable"; needs an ADR amendment, an env var and tight HR-only guards), edited email templates, and the Site URL and redirect
  URLs set to the Vercel domain. Open product decisions: invite expiry and resend, a `users` row whose invite is never accepted,
  deactivating leavers. Roughly a day or more plus SMTP setup; **not for Monday**. Start with the SMTP provider, a PRD story and the
  ADR amendment.
- **Google sign-in and HR user management are parked** (the user chose Supabase email and password and dropped the HR
  add-user screen for now). HR policy configuration (decision 11) is still open.
- Cheap retro backlog items to fold into polish: friendly validation messages, readable dates.

### Working style

- Flexible hours: sessions can be short or long. End each session with a clean, committed or clearly described state and an
  updated note.
- **The user commits straight to `main`** (no feature branch or PR): after `/validate` passes, they ask to commit (and push).
  Commits only happen on request. Conventional Commits, enforced by commitlint: the **subject must start lowercase**
  (`docs: ADR-E002 ...` was rejected). Task ids go in the body, not the subject. Attribution line as the environment states.
- The user runs **`next start`** (production build) for manual testing, not `npm run dev`. It does **not** pick up code
  changes: stop it, `npm run build`, `npm start`, hard refresh. **Never rebuild while their server is running** (it replaces
  `.next` underneath it).
- **Slip on 2026-10-14:** `npm run build` ran while the user's `next start` was listening on port 3000, which replaces `.next`
  under it (it was also serving a stale build). The user should stop it, run `npm run build`, then `npm start` to see the new UI.
  Use a different port (I used 3001 with `next dev`) for any check of mine, and stop only what I started.
- **Never ask the user to paste a secret in chat** (the Supabase URL and anon key were typed into `.env.local` by the user; the service-role key and the demo password stay in the user's own shell).
- **Do not start or stop dev servers unless necessary; check what is listening first** (saved as a memory). **Gate every
  `npm run build` on that check in the same command** (it slipped twice, 2026-10-14 and 2026-10-15). Use vitest and `psql`
  against a throwaway database for verification; my own dev server for checks runs on port 3001 and I stop only that one.
- One evaluate and plan per task unless the tasks are genuinely coupled (011+012 and 013+014 were; 015 and 017 were done
  separately). The user approves each plan.
- Do not assume when the requirements are silent (the user corrected this): list the open decision and its impact first.

### Defaults for the demo (**CONFIRMED by the user on 2026-10-14**, all implemented)

1. Roles stack: managers and HR admins can also request leave. 2. Rejection note in `leave_requests.decision_note`.
2. Manager "notification" = the pending item in their approvals queue (no email). 4. Leave days are working days (Mon-Fri), no
   holidays. 5. Mock login, clearly labelled, fake data only. 6. The top person's leave is approved by a second `hr_admin`
   (Sam Okafor in the seed). 7. `reason` is optional. 8. The over-balance warning is a `warnings` field in the success payload.

---

## 1. Verified project state

### Source control

- `origin/main` is at `06dee3f` and local `main` matches it (pushed 2026-10-18; verified with `git status -sb`). Newest first:
  `06dee3f` docs: mark epic-2 tasks done and record the staging rollout; `155e9df` docs: add staging rollout runbook, demo checklist
  and demo requests; `7ca4ae2` docs: update handoff for the end of the 2026-10-17 session; `bababb5` fix: make the supabase session cookie httpOnly and Secure and close log redaction gaps
  (TASK-025); `3337112` docs: update handoff for the 2026-10-17 session (an earlier version of this file); `517ce12` fix: stream
  page sections and retry stalled reads; `c4e8c4e` docs: update handoff for the 2026-10-16
  session; `169bbcc` fix: deadlines on auth calls and queries; `6cda7f3` fix: report db and auth outages as unavailable and log
  slow queries; `50a74d5` feat: script to create supabase auth users (TASK-024); `35a734b` feat: email and password sign-in
  (TASK-022); `5f49aaf` feat: supabase session resolution and proxy session check (TASK-020 + 021); then the earlier
  commits. `main` is the only branch, and commits go straight to it. commitlint limits body lines to 100 characters.
- `gh` is not installed: CI can only be checked on the GitHub website.
- Package manager is **npm only**.
- Git prints "CRLF will be replaced by LF" warnings on Windows; harmless (lint-staged runs prettier).

### Quality gate (re-verified 2026-10-16 evening on the committed tree)

Re-verified 2026-10-17 on the `bababb5` code: `lint`, `format:check` and `typecheck` pass; **369 tests passed, 14 skipped** (39 test
files passed, 3 skipped; the skipped ones are the gated real-database tests, not re-run). `npm run build` passed in a throwaway copy.
Real-Supabase checks were done by the user. The black-hole smoke script was a scratchpad file (not kept): a Python socket that
accepts and never answers, `DATABASE_URL` pointed at it, built copy on port 3002, mock login cookie `mock-role=employee`.
TASK-025 was also checked on a production build in a throwaway copy: response headers with `curl -D -`, headless Chrome driven
through the DevTools protocol (`/login`, mock sign-in, `/dashboard`; console and cookie flags), and the real `@supabase/ssr`
against a fake Auth server for the cookie flags. Those scripts were scratchpad files (not kept); the method is in
`knowledge/patterns/implement-and-test.md`, "Canonical security-verification pattern".

### Built

- **Infrastructure and mock auth (Day 0):** route guard `src/proxy.ts`, mock login/logout (cookie `mock-role`, one fixed user
  per role: employee = Elena, manager = Marco, hr_admin = Hana), `/api/health`, shared toolbox in `src/lib/` (`env`, `logger`,
  `errors`, `auth`, `db`, `mock`). **Superseded 2026-10-16: real Supabase sign-in now exists; the mock cookie is only a labelled fallback behind `ALLOW_MOCK_LOGIN`.**
- **Schema:** migrations `20261013000000_init_leave_domain`, `20261014000000_seed_leave_types`,
  `20261014120000_add_decision_note`, `20261015000000_accrual_ledger`. 7 tables, RLS on, append-only triggers on `audit_log`
  and `accrual_ledger`, no hard deletes on `leave_requests`. A rejected request needs a decision note (constraint
  `leave_requests_rejection_note`). **No migration was added on 2026-10-15.**
- **TASK-011/012 (submit + balance), TASK-013/014 (queue + decisions), TASK-017 (accrual), TASK-015 (HR audit), TASK-018
  (leave-type independence, tests):** unchanged behaviour; see the retros. Routes: `POST/GET /api/leave-requests`,
  `POST /api/leave-requests/:id/decision`, `GET/POST /api/jobs/accrual`, `GET /api/audit/:userId`.
- **UI shell (committed):** left sidebar from Figma (232px, collapses to 72px; below `lg` a modal drawer with focus trap),
  slim top bar with the page title and an account dropdown (name, role, email, Sign out; Escape and outside click close it),
  role-aware items from `navItemsFor(role)`, workspace label per role.
- **Dashboard:** welcome block with a role-aware subtitle and "Request Leave"; summary cards from
  `src/lib/leave/dashboard.ts` (Vacation, Sick, Unpaid "Untracked", and Pending approvals for managers and HR).
- **Calendar:** `src/lib/leave/calendar.ts` (role-scoped month query: employee `r.user_id`, manager
  `(r.user_id or u.manager_id)`, HR everyone; soft-deleted never; rejected only with the flag), `calendar-layout.ts` (pure grid,
  lanes, today in `APP_TIMEZONE`, owners text), `leave-calendar.tsx`, `rejected-toggle.tsx`. Month and switch live in the URL
  (`?month=YYYY-MM`, `?rejected=1`); bars are `aria-hidden` and every request is also listed as text.
- **Seed (`supabase/seed.sql`, idempotent):** 7 fake users (Sam Okafor, second hr_admin, is Hana's manager), Vacation 10 / Sick 5
  demo balances for every user, 3 demo pending requests (Jun, Leo, Marco), each with a `submitted` audit row.

### Built on 2026-10-16 (see "What was done on 2026-10-16")

- Real sign-in: `src/lib/supabase/{server,proxy,fetch}.ts`, `src/lib/auth/{session,users,mock-cookie}.ts`, `src/app/login/*`,
  `src/lib/db/timed.ts`, `scripts/seed-auth-users*.ts`, `SERVICE_UNAVAILABLE` (503) in `app-error.ts`, `maxDuration` on routes.

### Built on 2026-10-17

- `timedRead` in `src/lib/db/timed.ts`; `getBalanceSummary` in `src/lib/leave/service.ts`; the dashboard's `sections.tsx` and
  `skeletons.tsx`; `balance-section.tsx` and `balance-skeleton.tsx`; `request-form-section.tsx` and `request-form-skeleton.tsx`;
  section tests (`*.test.ts` only: Vitest's include pattern skips `.tsx`).
- TASK-025: `src/lib/supabase/cookie-options.ts` (+ test), `server.test.ts`, `src/lib/logger.test.ts`,
  `src/lib/security-guards.test.ts`; `REDACT_PATHS` exported from `logger.ts`; `sessionCookieOptions` now uses `isSecureCookie`.

### Not built or not connected

- **Mock fallback:** while `ALLOW_MOCK_LOGIN` is true anyone with the URL can pick a role (Elena, Marco or Hana only). Switch it off
  before the demo. Real accounts exist for all seven seeded users.
- **No request detail page, no cancel**, no upcoming leave, no recent activity, no manager filters or HR team view.
- **Figma pages not yet designed:** Request Leave, My Balance, Team Approvals (the user will send a link).
- **No HR override** for over-balance requests (see decisions). **No pro-rating, no ledger screen, no export.**
- No monitoring or alerting; a missed cron run is repaired by the next but nobody is told.

### Machine and tooling notes

- **2026-10-17, macOS (zsh):** unquoted `--include=*.ts` globs and a lone `=====` argument fail in zsh (quote them); a script run
  as `zsh file` lost its `PATH` here, so run scratch scripts with `bash`. The notes below about Windows, PowerShell and
  `C:\...` paths describe the earlier machine.
- Node 22.19, Windows 11, shells: Git Bash and PowerShell. **In one Bash call, avoid several heredocs with quotes; it failed
  twice with "unexpected EOF". Use the Write tool for files.** Files written with Python's default newline come out CRLF on
  Windows; `prettier --write` (also run by lint-staged) normalises them.
- PostgreSQL 18 client tools are on PATH (`C:\Program Files\PostgreSQL\18\bin`).
- **Local dev database:** Postgres 18 on port **54329**, database `leavetrack`, data in `C:\Users\user\leavetrack-pgdata`
  (outside the repo). Migrations and the seed are applied (verified: 7 users, empty `accrual_ledger`, plus the user's own test
  requests). `.env.local` (git-ignored) holds `APP_ENV=development` and
  `DATABASE_URL=postgres://postgres@localhost:54329/leavetrack`. It stops when the machine restarts. Start it (in the
  background) with
  `"C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D C:\Users\user\leavetrack-pgdata -o "-p 54329" start`
  and stop it with the same command ending in `stop`; restart the app afterwards. Without the database, `/balance` and the
  other data pages show the error page; that is expected. Test requests can only be soft-deleted (triggers block hard
  deletes); to reset, drop and recreate the database and re-apply the migrations and seed. Verification databases are named
  `leavetrack_test` and dropped afterwards, never the user's `leavetrack`.
- graphify 0.9.88 (Python 3.13, `[sql]` extra); `graphify-out/` is git-ignored and refreshed by a PostToolUse hook.
- `.mcp.json` holds a live API key (git-ignored; consider rotating). The `resolve_package_versions` MCP tool fails on Windows;
  check `npm view <pkg> dist-tags` before pinning. Pins held below latest: eslint 9.39.5, TypeScript 6.0.3, lint-staged 16.4.0.
- `next dev` is no longer allowed to edit `AGENTS.md` (`agentRules: false` in `next.config.ts`, verified in the installed types).
- After moving or renaming routes delete the git-ignored `.next/`.
- postgres.js returns `date` columns as JS `Date` objects although `types.ts` says `string`: cast to `::text` in queries.
- `generate_series(date, date, interval)` returns `timestamptz`: cast the inputs to `timestamp` (done in the accrual SQL).
- Headless Chrome was driven through the DevTools protocol for 375/320/1280 px checks (scripts were in the session scratchpad).
- `claude.exe` auto-update failed once because another session held a file lock; harmless.

- **Throwaway databases:** create `leavetrack_test` on the local server (port 54329), apply `supabase/migrations/*.sql` then
  `supabase/seed.sql`, run the gated tests with `TEST_DATABASE_URL=postgres://postgres@localhost:54329/leavetrack_test`, and
  drop it afterwards. To see the app against it, start `next dev -p 3001` with `DATABASE_URL` set to the same URL
  (process env beats `.env.local`). Never touch the user's `leavetrack` database.
- **Browser checks without extra packages:** Node 22 has a global `WebSocket`, so a small script can drive headless Chrome
  (`C:/Program Files/Google/Chrome/Application/chrome.exe`, `--remote-debugging-port`) through CDP; no puppeteer is installed.
  React writes inline `style` differently on the server and after client navigation, so read computed styles (for example
  `getComputedStyle(el).gridColumnStart`) instead of matching the attribute text.
- **Figma MCP:** `get_design_context` on a whole frame is too big to return and is saved to a file; parse it with Python
  (`json.load`, then regex on `data-name`). Asset URLs expire after 7 days; download them to `public/icons/` unedited. Set
  `sys.stdout.reconfigure(encoding="utf-8")` when printing it on Windows (`python -I` ignores `PYTHONIOENCODING`).
- **Tailwind v4:** a colour from a CSS variable needs the type hint, `bg-(color:--leave-color)`, `border-(color:--leave-color)`;
  Next 16 `searchParams` is a promise. vitest runs in `node` (no jsdom): use `renderToStaticMarkup` for structure tests, and the
  `react/no-children-prop` lint rule forbids a `children` prop in `createElement` (cast the props and pass children as an argument).
- **Heredocs:** several quoted heredocs in one Bash call fail with "unexpected EOF" (hit again today); use the Write tool for files.
- Postgres 18 was running on port 54329 at the end of the 2026-10-16 session (I started it with `pg_ctl` because it was not running); it stops when the machine restarts. `.env.local` also holds the two `NEXT_PUBLIC_SUPABASE_*` values (typed by the user).
- Node 22 runs `.ts` scripts natively (`node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/...ts`); relative imports need the `.ts` extension. `AbortSignal.any` and `AbortSignal.timeout` are available.
- **supabase-js has no fetch timeout, and `getUser()`/`getClaims()` retry a failed token refresh with backoff**: bound the whole call (`withDeadline`), not just the fetch. A thrown fetch error is wrapped as `AuthRetryableFetchError` by auth-js.
- Next.js `maxDuration` is valid in `layout.tsx`, `page.tsx` and `route.ts` (docs in `node_modules/next/dist/docs`). Curl cannot easily emulate a client-side RSC navigation (it needs the router-state headers); a plain document request works.
- postgres.js keeps retrying with backoff on `ECONNREFUSED` (dev pages took 12 to 19 s on later requests); pool size changes the failure-case latency (see 0a).
- In one Bash call even a single heredoc containing apostrophes failed with "unexpected EOF"; write scripts with the Write tool.

### Choices the user already made

- npm; raw SQL migrations in Supabase layout; `postgres.js`; indexes and the cron-secret guard approved.
- Commits only on request, after the work is validated; straight to `main`; subjects lowercase.
- Route handlers for every leave-data write (AGENTS.md rule 11); server actions only for login/logout.
- Option A for over-balance approval, `Done` as the task status word.

---

## 2. History: the TASK-010 leave-types gap (fixed 2026-10-14, commit `46c8e2a`)

`supabase db push` skips `seed.sql`, so a deployed database had **0 leave types**. Fixed by a forward-only migration with the same
fixed ids (Vacation/Sick tracked, Unpaid not), CI asserting 3 leave types after migrations and before the seed, and
`verify_schema.sql` checking ids and flags. The "3 rows" expectation lives in the migration, the CI step and `verify_schema.sql`.

---

## 3. Decisions

### Decided

| #        | Decision                                | Outcome                                                                                                                                                                                             |
| -------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-4, 6-8 | The 8 demo defaults (section 0)         | Confirmed 2026-10-14 and implemented.                                                                                                                                                               |
| 9        | Accrual idempotency design              | Per-employee, per-type, per-UTC-month ledger with a unique key; ADR-LeaveTrack-E002.                                                                                                                |
| 10       | Cron HTTP method                        | Vercel Cron sends **GET**; the route answers GET and POST. Docs updated.                                                                                                                            |
| 13       | Landing pages                           | One role-aware dashboard and shell.                                                                                                                                                                 |
| 14       | Source of "pending days"                | Derived from the user's own pending, non-deleted requests (never stored).                                                                                                                           |
| -        | Approving beyond the balance (option A) | Refused with 409; the manager can still reject. No negative balances, no invented balance rows.                                                                                                     |
| -        | Missing balance row on approval         | 409 and nothing created. (On **accrual** it is created holding exactly the accrued amount.)                                                                                                         |
| -        | Accrual catch-up                        | Missed months are accrued by the next run; the first run accrues the current month only.                                                                                                            |
| -        | Audit report and soft-deleted rows      | Excluded by default, shown flagged with `include_deleted=true`, never purged. Docs reconciled.                                                                                                      |
| -        | Other team / missing / deleted request  | Same 403 for all (no existence leak).                                                                                                                                                               |
| 5        | Real login provider (2026-10-15)        | Supabase Auth, email and password, sign-up disabled; linked to `users` by `lower(email)`; ADR-E003.                                                                                                 |
| -        | Demo credentials                        | The seven fake emails with one shared password the user chooses; no email is sent.                                                                                                                  |
| -        | Mock login after sign-in                | Kept only as a labelled fallback behind `ALLOW_MOCK_LOGIN`; switch it off after the demo.                                                                                                           |
| -        | HR creates users on screen              | Dropped for now (users come from SQL and the seeding script). Forced password change and invites later.                                                                                             |
| -        | Calendar visibility                     | Employee: own; manager: own plus direct reports; HR: everyone. Rejected hidden unless switched on.                                                                                                  |
| -        | Request details                         | A page (`/requests/[id]`), not a popup.                                                                                                                                                             |
| -        | Cancel (not built)                      | Soft-delete (`is_deleted` plus a `soft_deleted` audit row), own pending only (lean).                                                                                                                |
| -        | AC2 of TASK-021 (2026-10-16)            | User chose option A: prove with mocks now, real test with TASK-022 (done live).                                                                                                                     |
| -        | Auth outage behaviour (2026-10-16)      | `getSession()` throws 503 `SERVICE_UNAVAILABLE` (never null, never a session); proxy lets pages through to re-check and answers `/api/*` with 503; a real "no session" still redirects to `/login`. |
| -        | Deadlines (2026-10-16)                  | Auth 5 s (whole call), read queries 8 s, `maxDuration` 30 s (cron 60 s); writes have no query deadline.                                                                                             |
| -        | Pool size (2026-10-16)                  | Stays `max: 5`, `idle_timeout: 20`: shrinking it measured much slower under a stalled database.                                                                                                     |
| -        | `ALLOW_MOCK_LOGIN=true` on Vercel       | Temporary (the user's choice, 2026-10-16); must be removed before the supervisor demo.                                                                                                              |

### Still open

| #   | Decision                                 | Notes                                                                                                                        |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 11  | HR policy configuration                  | The PRD says HR configures policies; no EPIC-1 task builds it. Policies come from the seed/SQL for now.                      |
| -   | **HR override** of over-balance requests | PRD US-01 AC3 mentions it but never defines who overrides or whether the balance may go negative. Raise with the supervisor. |
| -   | Real-database tests in CI                | Two gated tests exist now (TASK-018 and the calendar); wire `TEST_DATABASE_URL` into `db-verify` (not done).                 |
| -   | Email delivery                           | No custom SMTP; Supabase's built-in sender is rate-limited. Needed for emailed invites, not for Monday.                      |
| -   | App time zone                            | `APP_TIMEZONE` is optional (UTC when unset); set it on Vercel.                                                               |
| -   | Client cache `staleTimes.dynamic: 30`    | Optional, experimental, would make going back to the dashboard instant; up to 30 s stale. The user has not decided.          |
| -   | Root cause of the staging stalls         | Unproven (section 0a). Deadlines and logs are in place; the dashboard-reliability task is the proposed next step.            |

### Say plainly to the supervisor in the demo

**If real sign-in (EPIC-2) is live on staging:** say that people sign in with their own email and password, that the seven demo
accounts share one demo password, and that the mock login is a labelled fallback (switched off if `ALLOW_MOCK_LOGIN` is off).
**If it is not:** login is a **mock** (any input; the role dropdown picks Elena, Marco or Hana), say so plainly. Either way: all
data is fake; HR creating users, forced password change, emailed invites and "forgot password" are not built; accrual's first scheduled run
is 1 Nov 00:00 UTC, so it is shown with a manual trigger; HR override of over-balance requests is not defined yet (such a
request can be submitted but only rejected); HR policy editing and email notifications are out of scope.

### Other open items

- **Vercel Deployment Protection vs the scheduled cron call is unverified.** After a deploy, check Settings → Cron Jobs and
  the runtime logs. Manual trigger: a GET with `Authorization: Bearer $CRON_SECRET` (plus Vercel's
  `x-vercel-protection-bypass` header for a protected deployment), from the user's own shell, never pasted into chat.
- Pages built after the UI foundation (approvals, audit, skeletons, request-form error handling) were not viewed by me in a
  browser; the user has seen balance, request form and the accrual result.
- Skeleton heights follow the real controls but were not compared pixel-for-pixel with the loaded pages.
- Backlog, all in the retros: validation messages show raw zod paths, ISO dates, no overlap detection, no component rendering
  tests (jsdom) (the sidebar and calendar behaviour was checked by a throwaway Chrome script), no audit of audit reads, partial
  `leave_requests` index and no date-range index (HR calendar at scale), no past-date check on approval, `.env.example`
  `DIRECT_URL` example shows the IPv6-only host, health check 1 s ping limit, title-case nav labels vs sentence-case page
  titles, avatar initials contrast 4.31:1 (from Figma), TASK-017 description has mojibake in the CSV. (The active nav link and
  the three-row mobile nav were fixed by the sidebar.)
- **Rotate the `.mcp.json` API key.**

---

## 4. Agreed workflow

```
"what's next?"  →  I recommend one task from the dependency tree, the retros, and open decisions
/evaluate       →  read CSV row, AGENTS.md, arch doc, knowledge/, graph. Summary only. Stop.
/plan           →  blueprint: files, one test per acceptance criterion, SQL, risks. No code. Stop.
/apply          →  build exactly the approved plan, nothing extra.
/validate       →  gate, real-database checks on a throwaway DB, each criterion PASS/FAIL; issues classed
                   BLOCKER / FIX NOW / BACKLOG; fix the first two; write the retro.
commit          →  only when asked, after validation; straight to main; lowercase subject.
```

Rules of engagement:

- Each step stops and waits for the user. Settle open decisions **before** `/plan`.
- Stage only the reviewed files; leave CSV statuses alone until the user asks (then `Done`).
- Verify with real checks (a throwaway Postgres for anything touching the database) and report failures plainly, including
  mistakes in my own tests.

### Task dependencies (EPIC-1)

```
010 ─┬─ 011 ─┬─ 016 (also needs 012)
     ├─ 012 ─┘
     ├─ 013 ── 014
     ├─ 015
     └─ 017        018 needs 011 + 017
```

Done: 010-015, 017, 018. Left: 016. Likely deferred beyond the MVP: email notifications, an HR policy editor, multiple roles per
person, mid-year policy changes, holiday calendars, real login.

---

## 5. Learning progress (tutor session, 2026-10-13)

The user is a beginner to this project's architecture and asked for an interactive, one-section-at-a-time tutor with analogies,
diagrams, and clear labels for built / planned / unknown. Sections 1-6 (big picture, architecture, tables, feature flows, auth and
migrations, codebase tour) were delivered; the tutor format was not continued after the build started. Understanding checks:
correct on what stops an unauthenticated API call (`proxy.ts`); partly correct on how `audit_log` relates to `leave_requests`
(a pointer, not a copy); not yet answered: why approve writes status, balance and audit in one transaction (now implemented and
tested: atomic, concurrent-safe), and the biggest risk of deploying the current state. Questions worth revisiting if asked:
authentication vs authorization, foreign keys as pointers, transactions, the connection pooler, and why the function region
should sit next to the database.

---

## 6. Where the rest is recorded

- `knowledge/retros/2026-10-13-day0-scaffold.md`: Day 0 fixes, backlog, dependency pin reasons.
- `knowledge/retros/2026-10-14-ui-foundation.md`: UI fixes and backlog.
- `knowledge/retros/2026-10-14-task-011-012-submit-and-balance.md`, `...-task-013-014-team-approvals.md`,
  `...-task-017-accrual.md`, `...-task-015-hr-audit.md`: per-task validation results, decisions and backlog.
- `knowledge/retros/2026-10-15-task-018-leave-type-independence.md`, `...-shared-ui-restyle.md`,
  `...-sidebar-shell-dashboard-cards.md`, `...-dashboard-calendar.md`.
- `knowledge/retros/2026-10-16-task-020-supabase-session.md`, `...-task-021-proxy-session.md`, `...-task-022-login-form.md`,
  `...-task-024-seed-auth-users.md`, `...-page-load-resilience.md`, `...-hang-protection.md` (the newest first to read), and the
  runbook `knowledge/runbooks/seed-auth-users.md`.
- `docs/arch-docs/ADR-LeaveTrack-E001-Auth-Session-Strategy.md`, `ADR-LeaveTrack-E002-Accrual-Idempotency.md` and
  `ADR-LeaveTrack-E003-Real-Sign-In.md`.
- `knowledge/rules/coding-standards.md` and `AGENTS.md`: the rules every task follows (AGENTS.md has 11 backend rules).
- `knowledge/patterns/implement-and-test.md`: the canonical scoping and retention tests (Leo Garcia must never appear in
  Marco's queue; soft-deleted rows are hidden from the HR audit unless asked for).
- `docs/dev-tasks/epic-1-leave-request-tasks.csv` (EPIC-1), `epic-2-authentication-tasks.csv` (sign-in, all `Open`) and
  `epic-3-dashboard-tasks.csv` (calendar, `Open`): the task source of truth. Their header is lowercase, 15 columns, statuses
  `Open`/`Done`.
