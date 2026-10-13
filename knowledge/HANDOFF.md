# LeaveTrack — Session Handoff

Last updated: 2026-10-13 · Code state: commit `6eca3a1` on `main`

A living note for starting a new session without chat history. Update it at the end of each session.
Everything below is either **verified** (checked on the date above) or explicitly marked as a
**decision**, **lean** (a recommendation, not agreed), or **unknown**.

**Suggested opening prompt for the next session:**

> Read AGENTS.md, knowledge/HANDOFF.md and the retro in knowledge/retros/, then tell me what's next.

---

## 1. Verified project state

### Source control

- 2 commits on `main`: `b5ae414 chore: day 0 scaffold`, `6eca3a1 chore: ignore graphify output and enforce npm`.
- **No git remote.** CI (`.github/workflows/ci.yml`) has never run on GitHub; its steps were replicated locally.
- Package manager is **npm only**. A stray `pnpm install` once added pnpm files; they were deleted.

### Quality gate (all green on 2026-10-13)

`lint`, `typecheck`, `format:check`, **48 tests (6 files)**, `next build`, and `npm audit --omit=dev` = 0 vulnerabilities.
Dev-only audit findings (5 high, `braces` via `eslint-config-next`) are documented in the retro.

### Built (Day 0, Option B: infrastructure and mock auth, no UI shell)

- Next.js 16 app: route guard `src/proxy.ts`, mock login/logout, bare `/dashboard`, `/api/health`, error pages.
- Shared toolbox in `src/lib/`: `env`, `logger`, `errors` (standard response envelope), `auth` (session, guards, cron secret, safe redirect), `db` (pooled client + row types), `mock/users`.
- Database migration `20261013000000_init_leave_domain.sql`: 6 tables, enums, constraints, approved indexes, triggers that block hard deletes and audit-log edits, RLS enabled with no policies.
- `supabase/seed.sql` (dev only, idempotent) and `supabase/tests/verify_schema.sql`.
- Docs: `AGENTS.md`, `CLAUDE.md` (imports AGENTS.md), README, `knowledge/` rules, prompts, patterns, retro.

### Not built or not connected

- **No leave feature exists** (submit, balance, team queue, decide, audit, accrual). All of EPIC-1 beyond the schema is unstarted.
- **No UI shell or design system.** `docs/designs/` does not exist; no design export was supplied.
- **No real authentication.** Login accepts anything and trusts a role cookie. Must never ship (ADR-LeaveTrack-E001).
- **No persistent dev database.** Throwaway Postgres instances used for verification were stopped.
- No Supabase project, no Vercel deployment, no `vercel.json` (cron schedule), no `.env.local`, no notification mechanism.
- Only `/api/health` touches the database client, and it works without a database (`db: "not_configured"`).

### Machine and tooling notes

- Node 22.19, Windows 11, shells: Git Bash and PowerShell.
- PostgreSQL 18 client tools are on PATH (`C:\Program Files\PostgreSQL\18\bin`). Docker is installed but was **not running** when last checked.
- `pg_ctl ... start` keeps the calling shell open on Windows; run it in the background.
- graphify 0.9.88 is installed in Python 3.13 with the `[sql]` extra. `graphify-out/` is git-ignored; a PostToolUse hook rebuilds it. Re-run `/graphify . --update` after doc changes to refresh semantic nodes.
- `.mcp.json` holds a live API key. It is git-ignored; never commit it, and consider rotating the key.
- The `resolve_package_versions` MCP tool fails on Windows (`WinError 2`). Versions were resolved from the npm registry instead. Check `npm view <pkg> dist-tags` before pinning.
- Pins held below latest for compatibility: eslint 9.39.5, TypeScript 6.0.3, lint-staged 16.4.0 (see the retro for the reasons).

### Choices the user already made

- Option B scaffold (no UI shell until a design export exists).
- npm; raw SQL migrations in Supabase layout; `postgres.js` for the database client.
- Indexes and the cron-secret guard approved as planned.
- Commits are made only on request, after the diff has been reviewed.

---

## 2. TASK-010 gap and recommended fix

**TASK-010 is mostly done, not complete.** Verified against a fresh empty Postgres:

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

### Recommended fix (NOT implemented)

1. New forward-only migration, timestamped after `20261013000000`, e.g. `..._seed_leave_types.sql`, inserting
   the 3 reference rows with the **same fixed IDs** used in `seed.sql` and `mock/users.ts`
   (`10000000-0000-4000-8000-00000000000{1,2,3}`: Vacation/true, Sick/true, Unpaid/false) using `ON CONFLICT (id) DO NOTHING`.
2. Remove the leave-type insert from `seed.sql` (or keep it with `ON CONFLICT DO NOTHING`; the migration is the source of truth).
3. In CI and `verify_schema.sql`, assert **3 leave types after the migration, before the seed runs**.
4. Do **not** edit the existing migration; it may already be applied somewhere.

### Related hardening (backlog)

- `verify_schema.sql` does not assert foreign keys, constraints, or that RLS actually denies an unprivileged role. All three were checked by hand and passed.
- A privileged role can bypass the guard triggers (`session_replication_role = replica`). Verified on local Postgres as superuser; **unverified** for Supabase's `postgres` role.
- Fake people exist twice (`seed.sql` and `src/lib/mock/users.ts`) and must be kept in sync by hand.

---

## 3. Unresolved decisions

None of these has been answered by the user. "Lean" is a recommendation only.

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

### Recommended order

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
should look like; role-based dashboards; when to use Docker versus deploying.

Understanding checks:

- **Correct:** `proxy.ts` is what stops an unauthenticated call to `/api/leave-requests` (the 401 response format was supplied by the tutor).
- **Partly correct:** `audit_log` links to `users` to record who acted (right); its link to `leave_requests` is a pointer to the request, not a copy of its details (corrected).
- **Not yet answered:** why approve writes status, balance and audit row in one transaction; the biggest risk of deploying the current state.

Concepts worth revisiting if the user wants: authentication versus authorization, foreign keys as pointers,
transactions, and the connection pooler.

---

## 6. Where the rest is recorded

- `knowledge/retros/2026-10-13-day0-scaffold.md`: fixes made, full backlog, dependency pin reasons.
- `knowledge/rules/coding-standards.md` and `AGENTS.md`: the rules every task follows.
- `knowledge/patterns/implement-and-test.md`: the canonical scoping and retention tests (Leo Garcia must never appear in Marco's queue).
- `docs/dev-tasks/epic-1-leave-request-tasks.csv`: the task source of truth.
