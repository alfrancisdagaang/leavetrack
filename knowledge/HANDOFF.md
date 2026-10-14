# LeaveTrack — Session Handoff

Last updated: Wednesday 2026-10-14, evening · Code state: `main` @ `ae16ed6` (pushed; working tree clean; `main` matches
`origin/main`). Edits to this file may be uncommitted.

A living note for starting a new session without chat history. Update it at the end of each session.
Everything below is either **verified** (checked by me on the date above), **reported** (the user told me; I did not see it),
or explicitly marked as a **decision**, **lean** (a recommendation, not agreed), or **unknown**.

**Suggested opening prompt for the next session:**

> Read AGENTS.md, knowledge/HANDOFF.md and the retro in knowledge/retros/, then run git log and git status.
> Tell me the current state in a few lines and what's next. Don't start any work yet.

**Suggested closing prompt for each session:**

> Update knowledge/HANDOFF.md for this session. Re-verify the repo state (git log, git status, tests), record what
> changed, which decisions I made, what's still open, and what to do next. Show me the diff and wait for my approval.
> Don't commit.

---

## 0. Deadline and demo plan (read this first)

- **Demo: Monday 2026-10-19.** The user must show their supervisor an **online** system. The user works alone as far as we
  know (unconfirmed) and can work weekends. Days left after today: Thu 10-15 to Mon 10-19 morning.
- **Supervisor's expected scope:** all user stories in the PRD, US-01 to US-08, which is all of EPIC-1 (tasks 010-018).
  Extra ideas the supervisor mentioned are a future decision and are parked. The user said they will bring **fixes and
  polish** after the tasks are done; treat those as new work, not as reopening `Done` tasks.
- **Ahead of schedule:** the plan had 011/012 on Thursday, 013/014 on Friday and 015/017 on Saturday. All of them, plus the
  UI foundation, were finished on Wednesday. Remaining EPIC-1 work: **TASK-018** and **TASK-016**, then polish and demo prep.
- **UI approach (done, prototype):** Claude-generated UI on a shared foundation: Tailwind v4 tokens in `src/app/globals.css`
  (navy + light grey, light-only), components in `src/components/ui/`, a role-aware app shell, brand text "leavetrack".
  The user called the first version "a good prototype, not polished". Page-specific **loading skeletons** now mirror each page.
- **"Online" means GitHub + Supabase (staging) + Vercel.** The demo uses the **mock login with fake data only** (the login page
  says so) and the URL is access-restricted (Vercel Deployment Protection).
- **Accounts and deployment:**
  - GitHub: private repo `alfrancisdagaang/leavetrack`. Everything is pushed to `main`. `gh` is not installed, so **I cannot see
    CI runs**; the user checks GitHub Actions on the website. I have not seen a report for the latest commits (unknown).
  - Supabase: project `staging`, region **ap-south-1 (Mumbai)** (the user confirmed this on 2026-10-14). All migrations reach it
    through the CI `db-push` job (GitHub **`production` Environment** secret `SUPABASE_DB_URL`, Session pooler string).
  - **Staging was seeded by the user** with `supabase/seed.sql` through the Supabase SQL Editor (7 fake users, balances,
    3 demo pending requests). **Reported**, not verified by me (I have no staging access and must not).
  - **Accrual on staging:** the user ran the job once manually and reported Elena's Vacation went **10 to 11.25**. **Reported.**
  - Vercel: Hobby plan, project from the GitHub repo, Deployment Protection on. Env vars: `APP_ENV=staging`, `DATABASE_URL`
    (Transaction pooler, port 6543), `CRON_SECRET`. `DIRECT_URL` deliberately unset.
  - **Function region:** the first Vercel log showed functions running in **Washington (iad1)**, the default, while the database
    is in Mumbai, which made every page slow. `vercel.json` now sets `"regions": ["bom1"]` (it overrides the dashboard setting,
    which showed "Overridden"). The user says the redeploy is "okay now". **Unverified by me:** I have not seen a runtime log
    line saying "Routed to ... Mumbai (bom1)". The build log saying "Running build in Washington" is the _build machine_ and
    is normal, not the function region.
  - Passwords and connection strings were never committed. Never paste them into chat.

### Plan (remaining)

| Day               | Work                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Thu 10-15**     | Check CI and the Vercel deploy; `/plan` + build TASK-018; evaluate + build TASK-016 (mobile pass on every page)     |
| **Fri 10-16**     | Browser pass on every page as every role (nothing has been clicked through by me); fixes and polish the user brings |
| **Sat-Sun 10-18** | Demo prep: walkthrough script, reset/prepare staging data, rehearse; buffer for bugs                                |
| **Mon 10-19 am**  | Rehearse, then demo                                                                                                 |

If time runs short, cut in this order: polish, the optional real-database test wiring, extra features. The core loop
(US-01 to US-05) and accrual are done.

### Progress at the end of Wednesday 2026-10-14

- [x] TASK-010 schema + leave types · [x] UI foundation · [x] TASK-011 submit · [x] TASK-012 balance
- [x] TASK-013 team queue · [x] TASK-014 approve/reject · [x] TASK-017 monthly accrual · [x] TASK-015 HR audit
- [x] Vercel function region set to Mumbai; loading skeletons shipped (per page)
- [ ] **TASK-018** leave-type checks: **evaluated**, waiting for `/plan` (see "Next session")
- [ ] **TASK-016** mobile pass: not evaluated yet
- Task statuses in `docs/dev-tasks/epic-1-leave-request-tasks.csv`: **Done** for 010, 011, 012, 013, 014, 015, 017;
  **Open** for 016, 018 and EPIC-1 (verified).

### Next session: do these in order

1. Check GitHub Actions for `ae16ed6` (all green) and the Vercel production deploy. Then open a **runtime log entry for a real
   page request** (not an `_rsc` prefetch) on the newest deployment and confirm "Routed to ... Mumbai (bom1)".
2. `/plan` for **TASK-018** (already evaluated). It is test-only: the behaviour already exists (approve touches only the
   request's own leave type; Unpaid never reads or writes balances; submit never blocks). The gap is **committed proof**: no
   test shows submitting Unpaid succeeds, and nothing guards who may write `leave_balances`. Lean: fake-SQL tests in the gate
   (`service.test.ts` for `createLeaveRequest`, a "who writes `leave_balances`" guard) plus a **gated real-database test**
   (skipped unless `TEST_DATABASE_URL` is set), without touching CI yet. If a test exposes a real defect, flag it first.
3. `/evaluate` then `/plan` for **TASK-016**: re-measure every page at 375 and 320 px (balance and request form were measured
   on 2026-10-14; approvals, audit and the skeletons were not), the nav wraps to three rows at 375 px (UI retro backlog).
4. Do a **browser pass as each role** (Elena, Marco, Hana): submit, over-balance warning, reversed dates, approve/reject,
   audit with the soft-delete toggle, accrual line. Everything built after the UI foundation was verified through the real
   SQL and routes, but not clicked through.
5. **Discuss the polish and new-requirement ideas below** (raised by the user on 2026-10-14), after TASK-018 and TASK-016.
6. Demo prep (see section 3, "Say plainly to the supervisor").

### Ideas to discuss next session (after TASK-018 and TASK-016)

**Status of the PRD:** all user stories US-01 to US-08 are built. Two are not yet _closed_: US-06 (mobile) waits for TASK-016
and US-08 (independent leave types) waits for TASK-018. EPIC-1 is otherwise complete, and the user wants to **add to it** now
(fixes and polish, plus some new requirements). Nothing below is decided; each item needs its own evaluate and plan.

**A. Flow polish (the user's words, grouped).**

1. **Employee: cancel a request, and navigate their own requests easily.** Today `/balance` lists the last 50 requests with a
   status badge, and there is no way to cancel or open one. Ideas: a "My requests" view with a status filter and a detail
   page; a **Cancel** action on pending requests. _Open design question:_ cancel must not hard-delete (BR-04). Options: a new
   `cancelled` status (migration and enum change) or `is_deleted` plus the existing `soft_deleted` audit action. The audit
   report must still show it, and a cancel needs an audit row in the same transaction.
2. **Manager: approve/decline flow.** Easier navigation (filters by employee or leave type, a request detail view, a longer
   decided history than the 10-row "recently decided" list), clearer confirmation after a decision, possibly undo within a
   short window (would need a rule; decisions are currently final and audited).
3. **HR audit.** Filters such as **today, a preset range, all, per employee**, easier navigation, possibly export (CSV). The
   date range and the employee picker exist today (optional UTC `from`/`to`, include-soft-deleted toggle).

**B. Login page and Google sign-in (the user wants it "if possible", and documented).**

- Fix the login page (appearance and wording): polish, small.
- **Google sign-in as an additional method** is a new requirement and the open **decision 5** (real login provider). It is not
  in the PRD (US-01 to US-08). Docs come first: add the requirement and user stories to the BRD/PRD, an ADR (the provider; the
  session contract in ADR-LeaveTrack-E001 must stay the same: only how the cookie gets set changes), the architecture doc and
  new dev tasks (the repo's `/dev-tasks-planner` skill exists for this).
- Things a plan must settle: Supabase Auth with Google (the natural fit) vs another provider; a Google Cloud OAuth client and
  redirect URLs; new env vars (`env.ts` and `.env.example`); **only emails HR has added may sign in** (allowlist; the
  `users.email` lower-case unique index already exists); linking the Google account to the `users` row by email; how the
  **first HR admin** is created; keeping the mock login as a labelled fallback for the demo; Vercel Deployment Protection.

**C. HR user management (new requirement, same epic as B).**

- HR **adds new users**, assigns and **changes managers**, and manages roles. Needs a screen and API (route handlers only, rule 11).
- A new user needs a **leave policy and opening balance** or accrual and the balance page do nothing for them. That is the
  parked **decision 11** (HR policy configuration).
- Users cannot be deleted (foreign keys restrict), so leaving the company needs a deactivation flag. Changing a manager
  already re-routes pending requests (US-04 AC2, implemented through the live join on `users.manager_id`).

**D. Lean on ordering (not agreed; the user has not answered).** Polish A and the login-page fix before Monday; Google
sign-in and HR user management (B, C) after the demo unless the supervisor expects them there. **Open question for the user:**
does the supervisor expect real sign-in at the 2026-10-19 demo? If yes, plan B first, keep the mock login as a fallback, and
cut polish. Fold the cheap retro-backlog items into the polish round instead of a separate pass: friendly validation messages,
readable dates, an active nav link, the three-row mobile nav. The rest of the backlog (consolidate the retros into one
prioritised list) waits until after the polish and the new requirements.

### Working style

- Flexible hours: sessions can be short or long. End each session with a clean, committed or clearly described state and an
  updated note.
- **The user now commits straight to `main`** (no feature branch or PR): after `/validate` passes, they ask to commit and push.
  Commits only happen on request. Conventional Commits, enforced by commitlint: the **subject must start lowercase**
  (`docs: ADR-E002 ...` was rejected). Task ids go in the body, not the subject. Attribution line as the environment states.
- The user runs **`next start`** (production build) for manual testing, not `npm run dev`. It does **not** pick up code
  changes: stop it, `npm run build`, `npm start`, hard refresh. **Never rebuild while their server is running** (it replaces
  `.next` underneath it).
- **Do not start or stop dev servers unless necessary; check what is listening first** (saved as a memory). Use vitest and
  `psql` against a throwaway database for verification.
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

- `main` @ `ae16ed6`, pushed. Feature commits, newest first: `ae16ed6` page-specific skeletons, `b23f3df` first skeleton,
  `6947590` Vercel region bom1, `893654e` HR audit, `4f9391d` accrual, `42937a9` approvals + decisions, `b63b0b0` submit +
  balance, `7458a75` disable `next dev` agent rules, then the earlier UI foundation, leave-types migration and Day 0 scaffold.
  Docs and CSV-status commits sit between them. `main` is the only branch.
- `gh` is not installed: CI can only be checked on the GitHub website.
- Package manager is **npm only**.

### Quality gate (verified 2026-10-14 evening, on `ae16ed6`)

`lint`, `format:check`, `typecheck`, **201 tests (19 files)** and `next build` all pass. The build lists `/api/audit/[userId]`,
`/api/jobs/accrual`, `/api/leave-requests`, `/api/leave-requests/[id]/decision`, `/approvals`, `/audit`, `/balance`,
`/dashboard`, `/login`, `/requests/new`. Real-database behaviour was verified per task on throwaway PG 18 databases (the
harnesses were deleted afterwards; see the retros).

### Built (all EPIC-1 features except TASK-016/018 closing work)

- **Infrastructure and mock auth (Day 0):** route guard `src/proxy.ts`, mock login/logout (cookie `mock-role`, one fixed user
  per role: employee = Elena, manager = Marco, hr_admin = Hana), `/api/health`, shared toolbox in `src/lib/` (`env`, `logger`,
  `errors`, `auth`, `db`, `mock`).
- **Schema:** migrations `20261013000000_init_leave_domain`, `20261014000000_seed_leave_types`,
  `20261014120000_add_decision_note`, `20261015000000_accrual_ledger`. 7 tables, RLS on, append-only triggers on `audit_log`
  and `accrual_ledger`, no hard deletes on `leave_requests`.
- **TASK-011/012 (submit + balance):** `POST/GET /api/leave-requests`, `/requests/new`, `/balance`. Working-day counting,
  over-balance warning (never for Unpaid), pending days shown separately from the confirmed balance. Reversed dates disable the
  submit button and show an inline error.
- **TASK-013/014 (queue + decisions):** `GET /api/leave-requests?scope=team`, `POST /api/leave-requests/:id/decision`,
  `/approvals` (pending queue + a small "recently decided" list). Scope is in SQL (`u.manager_id = $caller`). One transaction:
  scoped `FOR UPDATE` lookup, guarded balance decrement, guarded status update, audit row. Other-team, missing and deleted
  requests all return the same 403.
- **TASK-017 (accrual):** `GET`/`POST /api/jobs/accrual` behind the `CRON_SECRET` bearer check (proxy + handler), `vercel.json`
  cron `0 0 1 * *` (00:00 UTC on the 1st). `accrual_ledger` unique per (employee, leave type, UTC month); one SQL statement;
  catch-up of missed months; first run accrues the current month only; Unpaid never accrues. ADR-LeaveTrack-E002 written.
  The balance page shows the month of the last accrual.
- **TASK-015 (HR audit):** `GET /api/audit/:userId`, `/audit` (HR only, any employee, optional UTC date range, include-soft-deleted
  toggle, per-request event timeline). Excludes soft-deleted requests by default; never selects the employee's free-text `reason`.
- **UI:** app shell, role-aware nav (all five items live), per-page loading skeletons, `Textarea` and `Skeleton*` components.
- **Seed (`supabase/seed.sql`, idempotent):** 7 fake users (Sam Okafor, second hr_admin, is Hana's manager), Vacation 10 / Sick 5
  demo balances for every user, 3 demo pending requests (Jun, Leo, Marco), each with a `submitted` audit row.
  `verify_schema.sql` checks the schema, the seed counts and the new constraints.

### Not built or not connected

- **No real authentication.** Login accepts anything and trusts a role cookie. Must never ship (ADR-LeaveTrack-E001). The mock
  login can only act as Elena, Marco or Hana, so **Sam, Jun, Leo and Priya cannot log in**; Hana's own requests (approver:
  Sam) cannot be decided in the demo UI.
- **No HR override** for over-balance requests (see decisions). **No pro-rating, no ledger screen, no export.**
- No real design (`docs/designs/` does not exist); the UI is a prototype on tokens.
- No monitoring or alerting; a missed cron run is repaired by the next but nobody is told.

### Machine and tooling notes

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

| #        | Decision                                | Outcome                                                                                         |
| -------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1-4, 6-8 | The 8 demo defaults (section 0)         | Confirmed 2026-10-14 and implemented.                                                           |
| 9        | Accrual idempotency design              | Per-employee, per-type, per-UTC-month ledger with a unique key; ADR-LeaveTrack-E002.            |
| 10       | Cron HTTP method                        | Vercel Cron sends **GET**; the route answers GET and POST. Docs updated.                        |
| 13       | Landing pages                           | One role-aware dashboard and shell.                                                             |
| 14       | Source of "pending days"                | Derived from the user's own pending, non-deleted requests (never stored).                       |
| -        | Approving beyond the balance (option A) | Refused with 409; the manager can still reject. No negative balances, no invented balance rows. |
| -        | Missing balance row on approval         | 409 and nothing created. (On **accrual** it is created holding exactly the accrued amount.)     |
| -        | Accrual catch-up                        | Missed months are accrued by the next run; the first run accrues the current month only.        |
| -        | Audit report and soft-deleted rows      | Excluded by default, shown flagged with `include_deleted=true`, never purged. Docs reconciled.  |
| -        | Other team / missing / deleted request  | Same 403 for all (no existence leak).                                                           |

### Still open

| #   | Decision                                 | Notes                                                                                                                             |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Real login provider                      | Supabase Auth is the natural fit, not chosen. Needed before go-live, not before features.                                         |
| 11  | HR policy configuration                  | The PRD says HR configures policies; no EPIC-1 task builds it. Policies come from the seed/SQL for now.                           |
| -   | **HR override** of over-balance requests | PRD US-01 AC3 mentions it but never defines who overrides or whether the balance may go negative. Raise with the supervisor.      |
| -   | Real-database tests in CI                | Five one-off harnesses were deleted after use. Promote them to a gated integration test (`TEST_DATABASE_URL`) run in `db-verify`. |

### Say plainly to the supervisor in the demo

Login is a **mock** (any input; the role dropdown picks Elena, Marco or Hana); all data is fake; accrual's first scheduled run
is 1 Nov 00:00 UTC, so it is shown with a manual trigger; HR override of over-balance requests is not defined yet (such a
request can be submitted but only rejected); HR policy editing and email notifications are out of scope.

### Other open items

- **Vercel Deployment Protection vs the scheduled cron call is unverified.** After a deploy, check Settings → Cron Jobs and
  the runtime logs. Manual trigger: a GET with `Authorization: Bearer $CRON_SECRET` (plus Vercel's
  `x-vercel-protection-bypass` header for a protected deployment), from the user's own shell, never pasted into chat.
- Pages built after the UI foundation (approvals, audit, skeletons, request-form error handling) were not viewed by me in a
  browser; the user has seen balance, request form and the accrual result.
- Skeleton heights follow the real controls but were not compared pixel-for-pixel with the loaded pages.
- Backlog, all in the retros: validation messages show raw zod paths, ISO dates, no overlap detection, no active nav link,
  three-row mobile nav, no component rendering tests (jsdom), no audit of audit reads, partial `leave_requests` index, no
  past-date check on approval, `.env.example` `DIRECT_URL` example shows the IPv6-only host, health check 1 s ping limit.
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

Done: 010-015, 017. Left: 016, 018. Likely deferred beyond the MVP: email notifications, an HR policy editor, multiple roles per
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
- `docs/arch-docs/ADR-LeaveTrack-E001-Auth-Session-Strategy.md` and `ADR-LeaveTrack-E002-Accrual-Idempotency.md`.
- `knowledge/rules/coding-standards.md` and `AGENTS.md`: the rules every task follows (AGENTS.md has 11 backend rules).
- `knowledge/patterns/implement-and-test.md`: the canonical scoping and retention tests (Leo Garcia must never appear in
  Marco's queue; soft-deleted rows are hidden from the HR audit unless asked for).
- `docs/dev-tasks/epic-1-leave-request-tasks.csv`: the task source of truth (statuses updated to `Done`).
