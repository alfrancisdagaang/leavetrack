# LeaveTrack — Session Handoff

Last updated: Thursday 2026-10-15, evening · Code state: `main` is at `d97baa7`, **3 local commits NOT pushed** (`18e2efb`
tests, `0e9200c` shared-UI restyle, `d97baa7` sign-in docs) and **53 uncommitted paths** (the sidebar shell, dashboard cards,
the calendar, docs and retros; see section 1). `origin/main` is at `3c787a9` (pushed this session).

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
  **This is the top priority.** If it is not working end to end on staging by Saturday evening, demo the labelled mock
  fallback and say so plainly.
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
  - **New env vars to set on Vercel when the code needs them:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
    `ALLOW_MOCK_LOGIN` (sign-in, not yet built) and optionally `APP_TIMEZONE` (for example `Asia/Manila`; the calendar's
    "today" uses UTC when unset, so it can show the wrong day for a few hours).
  - Passwords, keys and connection strings were never committed. Never paste them into chat.

### Plan (remaining)

| Day               | Work                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Fri 10-16**     | Sign-in (EPIC-2): user does the Supabase steps, then TASK-020, 021, 022 (then 024, 025). Polish batch. Commit and push.                  |
| **Sat-Sun 10-18** | TASK-027 staging rollout (real emails/accounts, set `ALLOW_MOCK_LOGIN`), click-through as each role on the live URL, demo script, buffer |
| **Mon 10-19 am**  | Rehearse, then demo                                                                                                                      |

If time runs short, cut in this order: change-password page (TASK-026), polish, request detail page and cancel, extra features.
The core loop (US-01 to US-05), accrual, the sidebar shell, the cards and the calendar are done.

### What was done on 2026-10-15 (all verified in this session unless marked)

- **TASK-018** (leave-type independence): tests only, committed (`18e2efb`), CSV status `Done`. Retro
  `2026-10-15-task-018-leave-type-independence.md`. Includes the first **gated real-database tests** (skipped unless
  `TEST_DATABASE_URL` is set; passed 2/2 on a throwaway DB).
- **Shared UI restyle** (committed, `0e9200c`): Card, Button, PageHeader, fields, Badge, Alert, skeleton and page bodies moved to
  the dashboard tokens; `ink-muted` darkened to `#5b6c86` for 4.5:1. Retro `2026-10-15-shared-ui-restyle.md`.
- **Sign-in docs** (committed, `d97baa7`): PRD **US-09**, **ADR-LeaveTrack-E003** (Supabase Auth, email and password), ARCH auth
  update, and `docs/dev-tasks/epic-2-authentication-tasks.csv` (EPIC-2, TASK-020 to TASK-027, all `Open`). **No sign-in code exists yet.**
- **Sidebar shell + dashboard cards** (**uncommitted**): left sidebar (collapsible on desktop, drawer below `lg`), slim top bar,
  account dropdown (name, role, email, Sign out), welcome block and four summary cards. This is the reworded **TASK-023**
  (still `Open` in the CSV; the user has not asked to mark it `Done`). Retro `2026-10-15-sidebar-shell-dashboard-cards.md`.
- **Dashboard calendar** (**uncommitted**): month calendar scoped by role, from Figma. This is **TASK-030 / US-10** in the new
  `docs/dev-tasks/epic-3-dashboard-tasks.csv` (`Open`). Retro `2026-10-15-dashboard-calendar.md`.
- Docs also uncommitted: PRD **US-10**, `epic-3-dashboard-tasks.csv`, the reworded TASK-023 row.
- **Slip, 2026-10-15 (late):** I ran `npm run build` while the user's `next start` was listening on port 3000 (PID 24012), without
  gating the command on the port check. The build passed, but it replaced `.next` under the user's server. The user must stop
  it and run `npm start` again. (Same mistake as 2026-10-14; the memory note about dev servers is the rule to follow: **check
  the port in the same step, and do not build if anything listens on 3000**.)

### Progress

- [x] EPIC-1: TASK-010 to TASK-015, TASK-017, TASK-018 (`Done`) · [ ] **TASK-016** mobile pass (`Open`: the dashboard, request
      form and balance were measured; approvals and audit were not)
- [x] UI foundation, restyle, sidebar shell and cards (uncommitted), calendar (uncommitted)
- [ ] **EPIC-2 sign-in:** TASK-020 (Supabase clients, env, session resolution), 021 (`proxy.ts`), 022 (login form and actions),
      023 (sidebar shell, built but not marked), 024 (script to create Auth users), 025 (CSP and security review), 026
      (voluntary change-password page, first to cut), 027 (staging rollout). All `Open` in the CSV.
- [ ] **EPIC-3 dashboard:** TASK-030 calendar built (`Open` until the user asks). Not built: upcoming leave, recent activity,
      request detail page (`/requests/[id]`), the other Figma pages.

### Next session: do these in order

0. **Servers and commits.** Tell the user their `next start` must be restarted (`npm run build` is already done on the
   current code, then `npm start`; hard refresh). Offer commits: (a) docs: PRD US-10, epic-3 CSV, TASK-023 reword and the
   retros; (b) `feat:` sidebar shell and dashboard cards; (c) `feat:` dashboard calendar. Commit only when asked. The user
   pushes (or asks me to). Then check GitHub Actions.
1. **Sign-in (EPIC-2), the user's Monday requirement.** The user does these steps (I cannot, and no secret goes in chat):
   disable sign-ups and set the Site URL in the Supabase dashboard; put the project URL and anon key into Vercel; keep the
   service-role key local, for the seeding script only; choose the demo password. Then `/evaluate TASK-020`, `/plan`, `/apply`,
   `/validate`, in the dependency order 020, 021, 022, then 024, 025, 026, 027. The design is in ADR-LeaveTrack-E003 and the
   walk-through is in "Sign-in design" below.
2. **Polish batch** (the user agreed to items 1 to 5): header wrap (**fixed** by the sidebar), readable dates (still ISO on
   balance, approvals and audit), friendly validation messages (raw zod paths), login page look and wording, dashboard card
   arrows (**moot**: the old cards were replaced). Also the casing mismatch between nav labels and page titles.
3. **Request detail page `/requests/[id]`** (a page, not a popup, the user agreed): status, who approved or cancelled, when it
   was sent, from `audit_log`; then link the calendar bars and the "My requests" rows to it. Then **cancel**: soft-delete
   (`is_deleted = true` plus a `soft_deleted` audit row in one transaction), own pending requests only, through a route
   handler; no new status and no migration. Needs a PRD story first.
4. **Rest of the Figma dashboard:** upcoming leave and recent activity (each needs a scoped query; recent activity comes from
   `audit_log`). Then the Figma pages for Request Leave, My Balance and Team Approvals once the user sends the link.
5. **Manager team view and HR "manage managers" view** (the user's request): a manager sees all team requests with filters by
   leave type and by employee; HR sees managers and their teams. Needs PRD stories first. The HR calendar needs an employee
   filter and a "+N more" cap before 800 staff.
6. **TASK-016** mobile re-measure of approvals, audit and the request form, after the shell settles.
7. Demo prep (section 3, "Say plainly to the supervisor"). Offered, not done: extend `supabase/seed.sql` with a few idempotent
   demo requests (approved, rejected, multi-week, with audit rows) so the staging calendar is not nearly empty.

### Sign-in design (decided with the user on 2026-10-15; see ADR-LeaveTrack-E003)

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

- `main` is at `d97baa7`, **3 commits ahead** of `origin/main` (`3c787a9`): `18e2efb` test: prove leave types are independent;
  `0e9200c` feat: restyle shared ui to the dashboard tokens; `d97baa7` docs: add us-09 real sign-in, adr-e003 and epic-2 tasks.
- **Uncommitted (53 paths, verified by `git status`):** the sidebar shell and dashboard cards (`app-shell.tsx`, new
  `app-frame.tsx`, `account-menu.tsx`, `summary-card.tsx`, `src/lib/leave/dashboard.ts`, nav and skeleton changes, 8 new icon SVGs,
  `main-nav.tsx` and `header-menu.tsx` deleted), the calendar (`calendar.ts`, `calendar-layout.ts`, `leave-calendar.tsx`,
  `rejected-toggle.tsx`, their tests, `env.ts` and `.env.example` for `APP_TIMEZONE`, tokens in `globals.css`), the reworded
  TASK-023 row, PRD US-10, `epic-3-dashboard-tasks.csv`, and four retros.
- Feature commits, newest first: `0e9200c` restyle, `18e2efb` TASK-018 tests, `5afddfb` Figma dashboard header, `ae16ed6`
  page-specific skeletons, `6947590` Vercel region bom1, `893654e` HR audit, `4f9391d` accrual, `42937a9` approvals and decisions,
  `b63b0b0` submit and balance, then the UI foundation, leave-types migration and Day 0 scaffold. `main` is the only branch.
- `gh` is not installed: CI can only be checked on the GitHub website.
- Package manager is **npm only**.
- Git prints "CRLF will be replaced by LF" warnings on Windows; harmless (lint-staged runs prettier).

### Quality gate (verified 2026-10-15 evening on the working tree, including the uncommitted calendar work)

`lint`, `format:check`, `typecheck`, **262 tests passed and 10 skipped** (27 files; the skipped ones are the gated real-database
tests) and `npm run build` all pass. The build lists `/api/audit/[userId]`, `/api/health`, `/api/jobs/accrual`,
`/api/leave-requests`, `/api/leave-requests/[id]/decision`, `/approvals`, `/audit`, `/balance`, `/dashboard`, `/login`,
`/requests/new`. The gated tests (`leave-types.integration.test.ts`, `calendar.integration.test.ts`) were run with
`TEST_DATABASE_URL` on a throwaway PG 18 database: **10 of 10 pass**; the database was dropped afterwards. Older harnesses were
verified per task and deleted (see the retros). Headless Chrome checks (sidebar, drawer, dropdown, calendar scope and layout at
320 to 1440 px, three roles) were run against `next dev` on port 3001; the scripts were throwaway.

### Built

- **Infrastructure and mock auth (Day 0):** route guard `src/proxy.ts`, mock login/logout (cookie `mock-role`, one fixed user
  per role: employee = Elena, manager = Marco, hr_admin = Hana), `/api/health`, shared toolbox in `src/lib/` (`env`, `logger`,
  `errors`, `auth`, `db`, `mock`). **This is still the only sign-in; real sign-in (EPIC-2) is not built.**
- **Schema:** migrations `20261013000000_init_leave_domain`, `20261014000000_seed_leave_types`,
  `20261014120000_add_decision_note`, `20261015000000_accrual_ledger`. 7 tables, RLS on, append-only triggers on `audit_log`
  and `accrual_ledger`, no hard deletes on `leave_requests`. A rejected request needs a decision note (constraint
  `leave_requests_rejection_note`). **No migration was added on 2026-10-15.**
- **TASK-011/012 (submit + balance), TASK-013/014 (queue + decisions), TASK-017 (accrual), TASK-015 (HR audit), TASK-018
  (leave-type independence, tests):** unchanged behaviour; see the retros. Routes: `POST/GET /api/leave-requests`,
  `POST /api/leave-requests/:id/decision`, `GET/POST /api/jobs/accrual`, `GET /api/audit/:userId`.
- **UI shell (uncommitted):** left sidebar from Figma (232px, collapses to 72px; below `lg` a modal drawer with focus trap),
  slim top bar with the page title and an account dropdown (name, role, email, Sign out; Escape and outside click close it),
  role-aware items from `navItemsFor(role)`, workspace label per role.
- **Dashboard (cards uncommitted):** welcome block with a role-aware subtitle and "Request Leave"; summary cards from
  `src/lib/leave/dashboard.ts` (Vacation, Sick, Unpaid "Untracked", and Pending approvals for managers and HR).
- **Calendar (uncommitted):** `src/lib/leave/calendar.ts` (role-scoped month query: employee `r.user_id`, manager
  `(r.user_id or u.manager_id)`, HR everyone; soft-deleted never; rejected only with the flag), `calendar-layout.ts` (pure grid,
  lanes, today in `APP_TIMEZONE`, owners text), `leave-calendar.tsx`, `rejected-toggle.tsx`. Month and switch live in the URL
  (`?month=YYYY-MM`, `?rejected=1`); bars are `aria-hidden` and every request is also listed as text.
- **Seed (`supabase/seed.sql`, idempotent):** 7 fake users (Sam Okafor, second hr_admin, is Hana's manager), Vacation 10 / Sick 5
  demo balances for every user, 3 demo pending requests (Jun, Leo, Marco), each with a `submitted` audit row.

### Not built or not connected

- **No real authentication (EPIC-2 is all `Open`).** Login accepts anything and trusts a role cookie. Must never ship
  (ADR-LeaveTrack-E001, E003). The mock login can only act as Elena, Marco or Hana, so **Sam, Jun, Leo and Priya cannot log in**.
- **No request detail page, no cancel**, no upcoming leave, no recent activity, no manager filters or HR team view.
- **Figma pages not yet designed:** Request Leave, My Balance, Team Approvals (the user will send a link).
- **No HR override** for over-balance requests (see decisions). **No pro-rating, no ledger screen, no export.**
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
- Postgres 18 is running on port 54329 as of this session (started by `pg_ctl`, PID 2924); it stops when the machine restarts.

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

| #        | Decision                                | Outcome                                                                                                 |
| -------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1-4, 6-8 | The 8 demo defaults (section 0)         | Confirmed 2026-10-14 and implemented.                                                                   |
| 9        | Accrual idempotency design              | Per-employee, per-type, per-UTC-month ledger with a unique key; ADR-LeaveTrack-E002.                    |
| 10       | Cron HTTP method                        | Vercel Cron sends **GET**; the route answers GET and POST. Docs updated.                                |
| 13       | Landing pages                           | One role-aware dashboard and shell.                                                                     |
| 14       | Source of "pending days"                | Derived from the user's own pending, non-deleted requests (never stored).                               |
| -        | Approving beyond the balance (option A) | Refused with 409; the manager can still reject. No negative balances, no invented balance rows.         |
| -        | Missing balance row on approval         | 409 and nothing created. (On **accrual** it is created holding exactly the accrued amount.)             |
| -        | Accrual catch-up                        | Missed months are accrued by the next run; the first run accrues the current month only.                |
| -        | Audit report and soft-deleted rows      | Excluded by default, shown flagged with `include_deleted=true`, never purged. Docs reconciled.          |
| -        | Other team / missing / deleted request  | Same 403 for all (no existence leak).                                                                   |
| 5        | Real login provider (2026-10-15)        | Supabase Auth, email and password, sign-up disabled; linked to `users` by `lower(email)`; ADR-E003.     |
| -        | Demo credentials                        | The seven fake emails with one shared password the user chooses; no email is sent.                      |
| -        | Mock login after sign-in                | Kept only as a labelled fallback behind `ALLOW_MOCK_LOGIN`; switch it off after the demo.               |
| -        | HR creates users on screen              | Dropped for now (users come from SQL and the seeding script). Forced password change and invites later. |
| -        | Calendar visibility                     | Employee: own; manager: own plus direct reports; HR: everyone. Rejected hidden unless switched on.      |
| -        | Request details                         | A page (`/requests/[id]`), not a popup.                                                                 |
| -        | Cancel (not built)                      | Soft-delete (`is_deleted` plus a `soft_deleted` audit row), own pending only (lean).                    |

### Still open

| #   | Decision                                 | Notes                                                                                                                        |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 11  | HR policy configuration                  | The PRD says HR configures policies; no EPIC-1 task builds it. Policies come from the seed/SQL for now.                      |
| -   | **HR override** of over-balance requests | PRD US-01 AC3 mentions it but never defines who overrides or whether the balance may go negative. Raise with the supervisor. |
| -   | Real-database tests in CI                | Two gated tests exist now (TASK-018 and the calendar); wire `TEST_DATABASE_URL` into `db-verify` (not done).                 |
| -   | Email delivery                           | No custom SMTP; Supabase's built-in sender is rate-limited. Needed for emailed invites, not for Monday.                      |
| -   | App time zone                            | `APP_TIMEZONE` is optional (UTC when unset); set it on Vercel.                                                               |

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
  `...-sidebar-shell-dashboard-cards.md`, `...-dashboard-calendar.md` (the newest first to read).
- `docs/arch-docs/ADR-LeaveTrack-E001-Auth-Session-Strategy.md`, `ADR-LeaveTrack-E002-Accrual-Idempotency.md` and
  `ADR-LeaveTrack-E003-Real-Sign-In.md`.
- `knowledge/rules/coding-standards.md` and `AGENTS.md`: the rules every task follows (AGENTS.md has 11 backend rules).
- `knowledge/patterns/implement-and-test.md`: the canonical scoping and retention tests (Leo Garcia must never appear in
  Marco's queue; soft-deleted rows are hidden from the HR audit unless asked for).
- `docs/dev-tasks/epic-1-leave-request-tasks.csv` (EPIC-1), `epic-2-authentication-tasks.csv` (sign-in, all `Open`) and
  `epic-3-dashboard-tasks.csv` (calendar, `Open`): the task source of truth. Their header is lowercase, 15 columns, statuses
  `Open`/`Done`.
