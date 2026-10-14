# LeaveTrack — Session Handoff

Last updated: Wednesday 2026-10-14 · Code state: `main` @ `46c8e2a` (leave-types fix, deployed to staging) and branch
`feat/ui-foundation` @ `6e14843` (UI foundation, **pushed but NOT merged to `main`**). Edits to this file may be uncommitted.

A living note for starting a new session without chat history. Update it at the end of each session.
Everything below is either **verified** (checked on the date above) or explicitly marked as a
**decision**, **lean** (a recommendation, not agreed), or **unknown**.

**Suggested opening prompt for the next session:**

> Read AGENTS.md, knowledge/HANDOFF.md and the retro in knowledge/retros/, then run git log and git status.
> Tell me the current state in a few lines and what's next. Don't start any work yet.

**Suggested closing prompt for each session:**

> Update knowledge/HANDOFF.md for this session. Re-verify the repo state (git log, git status, tests), record what
> changed, which decisions I made, what's still open, and what to do next. Show me the diff and wait for my approval.
> Don't commit.

---

## 0. Deadline and demo plan (read this first)

- **Demo: Monday 2026-10-19.** The user must show their supervisor an **online** system. Work resumes Wednesday 2026-10-14.
  The user can work weekends and is working alone as far as we know (unconfirmed).
- **Supervisor's expected scope:** all user stories in the PRD, US-01 to US-08, which is all of EPIC-1 (tasks 010-018).
  The supervisor also said extra ideas can be added later; that is a future decision and is parked.
- **UI approach for the demo (DONE as a prototype, 2026-10-14):** Claude-generated prototype UI on a small shared foundation.
  The user chose **Navy Blue + Light Grey, clean corporate, light-only**, and the brand is the plain lowercase text
  **"leavetrack"** (no logo). Built: Tailwind v4 tokens in `src/app/globals.css`, 7 shared components in `src/components/ui/`,
  a role-aware app shell, restyled login / dashboard / error / 404. `AGENTS.md` and `coding-standards.md` were updated to
  match (the old "unstyled until a design export" rule is gone). The user viewed it locally and called it "a good prototype,
  not polished, a good start". It is on the branch `feat/ui-foundation` and **not yet merged to `main`**.
- **"Online" means GitHub + Supabase (staging) + Vercel.** The demo uses the **mock login with fake data only**, must be
  described to the supervisor as a demo login (the login page now says so), and the URL is access-restricted.
- **Accounts and deployment (verified with the user 2026-10-14):**
  - GitHub: private repo `alfrancisdagaang/leavetrack`. `main` and the UI branch are pushed. CI on `main` was green.
  - Supabase: project named `staging`, region **ap-south-1 (Mumbai)**. Both migrations were applied by the CI `db-push` job
    and the user confirmed 6 tables and **3 `leave_types` rows** in the Table Editor. `users` is empty (no seed on staging).
  - GitHub secret `SUPABASE_DB_URL` is set as a **`production` Environment secret** (the `db-push` job reads that environment)
    and uses the **Session pooler** string (host `aws-0-ap-south-1.pooler.supabase.com`, user `postgres.<ref>`, port 5432).
    The direct `db.<ref>.supabase.co` host is IPv6-only and GitHub runners are IPv4-only (my understanding, not tested).
    The first attempt failed with `password authentication failed`; the cause was a wrong password, fixed by resetting it.
  - Vercel: project created from the GitHub repo, **deployed and working**, deployment protection turned on. Env vars:
    `APP_ENV=staging`, `DATABASE_URL` (Transaction pooler, port 6543), `CRON_SECRET`. `DIRECT_URL` is deliberately unset.
    `/api/health` reports `db: "ok"`. The first request after idle returned `db: "error"` (cold start vs the 1s ping limit);
    a reload returned `ok`.
  - Passwords and connection strings were never committed. Never paste them into chat.

### Plan (6 days, almost no slack)

**The days below are targets, not a rigid timetable.** The user works whenever they have free time on a given day, so the
amount done per day will vary. Track progress by tasks finished (and the cut order below), not by the calendar day. Whenever
a session starts, recompute what is left and how many days remain until Monday, and say plainly if the plan has slipped.

| Day                   | Work                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Wed 10-14**         | Confirm defaults; push; leave-types fix; **put the current app online early**; UI foundation (Tailwind + kit) |
| **Thu 10-15**         | TASK-011 submit + TASK-012 balance; role-aware navigation and dashboard                                       |
| **Fri 10-16**         | TASK-013 team queue + TASK-014 approve/reject                                                                 |
| **Sat 10-17**         | TASK-015 HR audit + TASK-017 accrual                                                                          |
| **Sun 10-18**         | TASK-016 mobile pass, TASK-018 leave-type checks, bug fixes, demo data                                        |
| **Mon 10-19 morning** | Rehearse, then demo                                                                                           |

If time runs short, cut in this order: polish on 018, then mobile polish, then extra accrual features. The core loop
(US-01 to US-05) stays. A demo shortcut for accrual (seeded balances and a manual run) is acceptable if openly stated.
Check progress each evening and adjust. Deploying early (Wednesday) is deliberate: first-deployment surprises are the biggest unknown.

### Progress at the end of Wednesday 2026-10-14 (on plan; the Wednesday row is essentially done)

- [x] Defaults confirmed by the user (see below)
- [x] Pushed to GitHub; CI green on `main`
- [x] Leave-types fix (TASK-010 follow-up), commit `46c8e2a`, applied to staging
- [x] Put the app online early: Supabase staging + Vercel, protected, DB connected
- [x] UI foundation built, validated and committed on `feat/ui-foundation` (`6e14843`), pushed
- [ ] **Not done:** GitHub CI result for the UI branch not checked; Vercel **preview** of the branch not opened on a phone;
      branch **not merged to `main`**, so the live staging site still shows the old unstyled UI.
- Days left to the Monday demo: 5 (Thu 10-15 to Mon 10-19 morning). Nothing has slipped yet.

### Next session: do these in order

1. Check the CI run for `feat/ui-foundation` on GitHub, and open the Vercel preview on a phone.
2. Merge the branch to `main` (the user decides: PR or a direct merge) so Vercel deploys it. `db-push` will find nothing new.
3. Decide the `next dev` agent-rules block (see Open items).
4. Decide how to get demo users into staging (it has no users, and the pages need them). Lean: run the fake seed once on
   staging, clearly labelled as demo data; **needs the user's OK first**.
5. Then the normal cycle for the **TASK-011 + TASK-012 batch**: `/evaluate`, then `/plan`, wait for approval. Each later task
   flips its `available` flag in `src/components/ui/nav.ts` so its nav link and dashboard card go live.

### Working style for this week

- Flexible hours: sessions can be short or long and happen at any time. End every session with a clean, committed or
  clearly described state and an up-to-date note, so the next session can resume from wherever the last one stopped.
- Batch the cycle: one evaluate and plan per slice (011 with 012, 013 with 014) instead of one per task. The user still
  approves each plan; commits still happen only on request after reviewing the diff.
- Open decisions use the defaults below unless the user objects.

### Defaults for the demo (proposed by the tutor, **CONFIRMED by the user on 2026-10-14**)

1. Roles stack up: managers and HR admins can also request leave.
2. Rejection note stored in a new nullable `decision_note` column on `leave_requests`.
3. Manager "notification" = pending items shown in their approvals queue (no email).
4. Leave days counted as working days (Mon-Fri); holidays out of scope.
5. Mock login for the demo, clearly labelled, fake data only.
6. The top person's leave is approved by a second `hr_admin`.
7. The `reason` field is optional.
8. The over-balance warning is returned in a `warnings` field of the success payload.

---

## 1. Verified project state

### Source control

- `main` @ `46c8e2a`: `b5ae414` day 0 scaffold, `6eca3a1`, `e3c8e1e`, `7705cce` (handoff notes), `ea4f0a6` + `45fc0e8` (graphify rule and
  hook), `46c8e2a fix: ship leave types via migration`. All pushed; CI on `main` is green, including `db-push` to staging.
- Branch `feat/ui-foundation` @ `6e14843 feat: ui foundation with navy theme and app shell`: pushed, tracking `origin`,
  **not merged**. Working tree was clean when this note was drafted.
- `gh` (GitHub CLI) is not installed, so CI runs can only be checked on the GitHub website.
- Package manager is **npm only**. A stray `pnpm install` once added pnpm files; they were deleted.

### Quality gate (all green on 2026-10-14, on `feat/ui-foundation`)

`lint`, `typecheck`, `format:check`, **53 tests (7 files)**, `next build`, and `npm audit --omit=dev` = 0 vulnerabilities.
Dev-only audit findings (5 high, `braces` via `eslint-config-next`) are documented in the retro. Database checks for the
leave-types migration were run on a throwaway PG 18 (migrations only = 3 rows; re-apply idempotent; full path; negative test).

### Built

- **Day 0 (infrastructure and mock auth):**
- Next.js 16 app: route guard `src/proxy.ts`, mock login/logout, `/api/health`, error pages.
- Shared toolbox in `src/lib/`: `env`, `logger`, `errors` (standard response envelope), `auth` (session, guards, cron secret, safe redirect), `db` (pooled client + row types), `mock/users`.
- Database migration `20261013000000_init_leave_domain.sql`: 6 tables, enums, constraints, approved indexes, triggers that block hard deletes and audit-log edits, RLS enabled with no policies.
- `supabase/seed.sql` (dev only, idempotent) and `supabase/tests/verify_schema.sql`.
- Docs: `AGENTS.md`, `CLAUDE.md` (imports AGENTS.md), README, `knowledge/` rules, prompts, patterns, retro.
- **2026-10-14, on `main`:** migration `20261014000000_seed_leave_types.sql` (Vacation/Sick/Unpaid with fixed IDs,
  `on conflict do nothing`); the insert was removed from `seed.sql`; a CI step in `db-verify` now asserts 3 leave types
  **after migrations and before the seed**; `verify_schema.sql` also checks the ids/names/`tracks_balance`.
- **2026-10-14, on `feat/ui-foundation` only (not merged):** Tailwind v4 (`tailwindcss` and `@tailwindcss/postcss`, both
  pinned 4.3.3, devDependencies), tokens in `src/app/globals.css`, `src/components/ui/` (button, field, card, badge, alert,
  page-header, app-shell, plus `nav.ts` with `navItemsFor(role)` and tests), and a `src/app/(app)/` route group whose layout
  renders the shell (URLs unchanged; `/dashboard` moved into it). Light-only; system font stack (CSP-safe).
  Nav items for pages that do not exist yet show as "(soon)" until each task sets its `available` flag to true.
  Retro: `knowledge/retros/2026-10-14-ui-foundation.md`.

### Not built or not connected

- **No leave feature exists** (submit, balance, team queue, decide, audit, accrual). All of EPIC-1 beyond the schema is unstarted.
- **No real design.** `docs/designs/` does not exist; the UI is a prototype on tokens that a real design can later replace.
- **No real authentication.** Login accepts anything and trusts a role cookie. Must never ship (ADR-LeaveTrack-E001).
- **No persistent local dev database.** Throwaway Postgres instances used for verification were stopped.
- **Staging has no users** (the seed is dev-only). The mock login picks a session role, but the pages that will read data
  need users in the database, so a decision on demo data is open (see "Next session").
- No `vercel.json` (cron schedule, needed for TASK-017), no `.env.local`, no notification mechanism.
- Only `/api/health` touches the database client. On Vercel it now reaches the staging DB (`db: "ok"` after the first request).

### Machine and tooling notes

- Node 22.19, Windows 11, shells: Git Bash and PowerShell.
- PostgreSQL 18 client tools are on PATH (`C:\Program Files\PostgreSQL\18\bin`). Docker is installed but was **not running** when last checked.
- `pg_ctl ... start` keeps the calling shell open on Windows; run it in the background.
- graphify 0.9.88 is installed in Python 3.13 with the `[sql]` extra. `graphify-out/` is git-ignored; a PostToolUse hook rebuilds it. Re-run `/graphify . --update` after doc changes to refresh semantic nodes.
- `.mcp.json` holds a live API key. It is git-ignored; never commit it, and consider rotating the key.
- The `resolve_package_versions` MCP tool fails on Windows (`WinError 2`). Versions were resolved from the npm registry instead. Check `npm view <pkg> dist-tags` before pinning.
- Pins held below latest for compatibility: eslint 9.39.5, TypeScript 6.0.3, lint-staged 16.4.0 (see the retro for the reasons).
- `next dev` may pick port 3001 (something unknown holds 3000 on this machine). **`next dev` also appends a "This is NOT the
  Next.js you know" block to `AGENTS.md`** (tracked file) every time it runs; I kept it out of the UI commit. Open decision.
- After moving or renaming routes, delete the git-ignored `.next/` folder; stale generated types broke `typecheck` and `build` once.
- Headless Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) was driven through the DevTools protocol to take
  real 375/320/1280px screenshots and measure horizontal overflow. The script lived in the session scratchpad and is not in the repo.
- `claude.exe` auto-update failed because another Claude Code session was open (a Windows file lock). Harmless; run `claude doctor`
  and `claude update` after closing all sessions. I did not run them.

### Choices the user already made

- Option B scaffold (originally "no UI shell until a design export exists"; superseded on 2026-10-14 by the prototype UI).
- npm; raw SQL migrations in Supabase layout; `postgres.js` for the database client.
- Indexes and the cron-secret guard approved as planned.
- Commits are made only on request, after the diff has been reviewed.

---

## 2. TASK-010 gap and fix (FIXED 2026-10-14, commit `46c8e2a`; kept as history)

**Status: resolved.** The migration `20261014000000_seed_leave_types.sql` ships the 3 leave types, CI asserts them before
the seed, and the user confirmed 3 rows on the staging database. The CSV status is still `Open` (the user has not asked to
change it). Below is what was found on 2026-10-13; every "Fail" is now a pass.

**TASK-010 was mostly done, not complete.** Verified against a fresh empty Postgres:

| Acceptance criterion                                | Result                           |
| --------------------------------------------------- | -------------------------------- |
| Migration runs clean on empty DB                    | Pass                             |
| 6 tables exist, FKs match the arch doc              | Pass (10 FKs, all columns match) |
| `leave_types` seeded with exactly 3 rows            | **Fail on the deployment path**  |
| `is_deleted` defaults to false, no hard-delete path | Pass                             |

**The gap:** after applying the migration alone, `leave_types` has **0 rows**. The 3 rows exist only in
`supabase/seed.sql`, and `supabase db push` skips the seed unless `--include-seed` is passed. CI's deploy
step does not pass it. A real database would have no leave types, so no request could ever be created.
CI hides this because its check applies migration **and** seed before counting.

`seed.sql` cannot simply be pushed to production: it also creates six fake people.

### The fix that was implemented

1. New forward-only migration inserting the 3 reference rows with the **same fixed IDs** that `seed.sql` used
   (`10000000-0000-4000-8000-00000000000{1,2,3}`: Vacation/true, Sick/true, Unpaid/false) using `ON CONFLICT (id) DO NOTHING`.
   (The leave-type IDs live only in SQL; `mock/users.ts` holds users, not leave types.)
2. The leave-type insert was removed from `seed.sql`; the migration is the source of truth.
3. CI asserts **3 leave types after the migration, before the seed runs**; `verify_schema.sql` checks ids/names/flags.
   The "3 rows" expectation now lives in three places (migration, CI step, `verify_schema.sql`): update all if a type is added.
4. The existing migration was not edited.

### Related hardening (backlog)

- `verify_schema.sql` does not assert foreign keys, constraints, or that RLS actually denies an unprivileged role. All three were checked by hand and passed.
- A privileged role can bypass the guard triggers (`session_replication_role = replica`). Verified on local Postgres as superuser; **unverified** for Supabase's `postgres` role.
- Fake people exist twice (`seed.sql` and `src/lib/mock/users.ts`) and must be kept in sync by hand.

---

## 3. Unresolved decisions

"Lean" is a recommendation only. **On 2026-10-14 the user confirmed the 8 demo defaults in section 0**, which settles
decisions 1, 2, 3, 4, 6, 7 and 8 for the demo (stacked roles, `decision_note` column, in-app queue as the notification,
working days, second `hr_admin` approves the top person, optional `reason`, `warnings` field). Their "Lean" text below is
now the chosen approach; they are not yet implemented. Decisions 5, 9, 10, 11 and 14 are still open. Decision 12 (design
export) is superseded for the demo by the prototype UI, and decision 13 is implemented as the role-aware shell.

| #   | Decision                                                 | Options / lean                                                                                                                                                                      | Blocks                                                              |
| --- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Can a manager or HR admin also request leave?            | Lean: **stacked roles** (employee < manager < hr_admin, cumulative). Alternatives: multiple roles per user; separate accounts (not recommended: splits balances, needs two emails). | TASK-011 role check; seed policies and balances for managers and HR |
| 2   | Where is a rejection reason stored? (US-03 AC2)          | Lean: add nullable `decision_note` to `leave_requests` (new migration). Today no column exists; `reason` is the employee's own.                                                     | TASK-014                                                            |
| 3   | How is the manager "notified"? (US-01 AC1)               | In-app queue only / notifications table / email provider. Day 0 forbids external calls.                                                                                             | TASK-011                                                            |
| 4   | How are leave days counted?                              | Calendar days vs working days (Mon-Fri). Holidays are out of scope. Lean: working days.                                                                                             | 011, 012, 014, 018                                                  |
| 5   | Which real login provider?                               | Supabase Auth is the natural fit but is not chosen. Needed before go-live, not before features.                                                                                     | Go-live                                                             |
| 6   | Who approves the top person's leave?                     | Lean: assign a second `hr_admin` as their manager (data only).                                                                                                                      | Seed and real data                                                  |
| 7   | Is `reason` required on a request?                       | Schema default is an empty string.                                                                                                                                                  | TASK-011                                                            |
| 8   | How does the API return the over-balance warning?        | Propose a `warnings` field in the success payload.                                                                                                                                  | TASK-011                                                            |
| 9   | Accrual idempotency design                               | `ADR-LeaveTrack-E002` is cited but **does not exist**. Lean: `accrual_runs(period)` with a unique constraint.                                                                       | TASK-017                                                            |
| 10  | Cron HTTP method                                         | Arch doc says `POST /api/jobs/accrual`; Vercel Cron may send `GET`. **Verify against Vercel docs.**                                                                                 | TASK-017                                                            |
| 11  | HR policy configuration                                  | PRD says HR configures policies; **no EPIC-1 task builds it**. Could defer to a script or SQL for the MVP.                                                                          | HR experience                                                       |
| 12  | Design export                                            | `docs/designs/` missing, so no UI shell, tokens or component spec.                                                                                                                  | All UI work                                                         |
| 13  | Landing pages                                            | Lean: one role-aware dashboard with navigation, not three separate apps. Role checks on pages and APIs are the real enforcement.                                                    | UI shell                                                            |
| 14  | Where does "pending days" on the balance page come from? | Not stored; probably derived from pending requests. Unconfirmed.                                                                                                                    | TASK-012                                                            |

Also open in tooling: the `/create-pr` gate may never block (it waits for `blocked: true`, but the
`code-reviewer` agent reports via `ReportFindings`). Details in the retro.

### Other open items (2026-10-14)

- **`next dev` agent-rules block in `AGENTS.md`:** keep and commit it, or set `agentRules: false` in `next.config.ts` and
  leave it out. My lean is to turn it off. Undecided; the block is currently absent from the committed `AGENTS.md`.
- **Demo data on staging:** it has no users. Lean: run the fake seed once, labelled as demo data. Needs the user's OK.
- **Unverified after the UI work:** the white focus ring on the navy header was not looked at in a real browser (contrast is
  14.6:1 by calculation); the login form was not submitted in a browser; the Vercel preview was not opened.
- **Vercel function region** (lean: Mumbai, to sit next to Supabase) and the **1s health-check ping limit** (cold-start
  `db: "error"`): both are in the UI retro's backlog.
- **`.env.example`** `DIRECT_URL` example still shows the IPv6-only direct host; CI needs the Session pooler string.
- **Rotate `.mcp.json` API key** (see machine notes) and consider the `claude.exe` update note above.
- Retro backlog items from 2026-10-13 and 2026-10-14 are otherwise unchanged and still open.

---

## 4. Agreed workflow

```
"what's next?"  →  I recommend one task from the dependency tree, the retro, and open decisions
/evaluate       →  read CSV row, AGENTS.md, arch doc, knowledge/, graph. Summary only. Stop.
/plan           →  blueprint: files, one test per acceptance criterion, SQL, risks. No code. Stop.
/apply          →  build exactly the approved plan, nothing extra.
/validate       →  build, lint, typecheck, tests, real-database checks, each criterion
                   classed PASS/FAIL; issues classed BLOCKER / FIX NOW / BACKLOG; fix the first two.
commit          →  only when asked, after the diff has been reviewed.
```

Rules of engagement:

- Each step stops and waits for the user. Do not advance on your own.
- Settle open decisions **before** `/plan`, not during `/apply`.
- Show the full diff and `git status` before staging; stage only the reviewed files.
- Leave CSV task statuses as `Open` unless asked to change them.
- Commits are conventional (`type: summary`), enforced by commitlint; use the attribution line the environment specifies.
- Verify with real checks (a throwaway Postgres for anything touching the database). Report failures plainly.

### Task dependencies (EPIC-1)

```
010 ─┬─ 011 ─┬─ 016 (also needs 012)
     ├─ 012 ─┘
     ├─ 013 ── 014
     ├─ 015
     └─ 017        018 needs 011 + 017
```

### Recommended order (general; the Monday demo schedule in section 0 overrides it this week)

1. **TASK-010 follow-up**: the leave-types migration (section 2).
2. **TASK-017** accrual (the BRD's riskiest requirement; needs decisions 9 and 10, and the missing ADR).
3. **011** submit, then **012** balance.
4. **013** team queue, then **014** decide.
5. **015** HR audit.
6. **016** mobile pass, **018** leave-type checks.
7. **Real login** before any real data or go-live.

Likely deferred from the MVP: email notifications, an HR policy editor, multiple roles per person,
mid-year policy changes, holiday calendars.

---

## 5. Learning progress (tutor session, 2026-10-13)

The user is a beginner to this project's architecture and asked for an interactive, one-section-at-a-time tutor
with analogies, diagrams, and clear labels for built / planned / unknown.

| Section | Topic                                                    | Status    |
| ------- | -------------------------------------------------------- | --------- |
| 1       | Big picture: problem, roles, the 7 business requirements | Delivered |
| 2       | Architecture: security desk, pages and API, pooler       | Delivered |
| 3       | Database tables and relationships                        | Delivered |
| 4       | Feature flows, click to database (only login is real)    | Delivered |
| 5       | Auth, Supabase, migrations, seed data, what is connected | Delivered |
| 6       | Codebase tour and task dependency tree                   | Delivered |

Questions the user raised, all answered: why manager scoping matters; why the audit trail is strict; what "Day 0"
means; what the mock covers; how to inspect the database; how a manager can also be an employee; what the MVP
should look like; role-based dashboards; when to use Docker versus deploying; design options (Figma versus images versus
prototyping the UI in code); what to name the GitHub repo and Supabase project; what "user stories" means.

Understanding checks:

- **Correct:** `proxy.ts` is what stops an unauthenticated call to `/api/leave-requests` (the 401 response format was supplied by the tutor).
- **Partly correct:** `audit_log` links to `users` to record who acted (right); its link to `leave_requests` is a pointer to the request, not a copy of its details (corrected).
- **Not yet answered:** why approve writes status, balance and audit row in one transaction; the biggest risk of deploying the current state.

Concepts worth revisiting if the user wants: authentication versus authorization, foreign keys as pointers,
transactions, and the connection pooler.

---

## 6. Where the rest is recorded

- `knowledge/retros/2026-10-13-day0-scaffold.md`: fixes made, full backlog, dependency pin reasons.
- `knowledge/retros/2026-10-14-ui-foundation.md`: UI fixes (focus ring, input border contrast) and its backlog. It exists
  only on `feat/ui-foundation` until that branch is merged.
- `knowledge/rules/coding-standards.md` and `AGENTS.md`: the rules every task follows.
- `knowledge/patterns/implement-and-test.md`: the canonical scoping and retention tests (Leo Garcia must never appear in Marco's queue).
- `docs/dev-tasks/epic-1-leave-request-tasks.csv`: the task source of truth.
