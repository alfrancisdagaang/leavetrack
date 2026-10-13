# AGENTS.md — LeaveTrack

Rules for every developer and AI coding tool working in this repo. Read this before writing code.
Detailed standards: `knowledge/rules/coding-standards.md`.

## ⚠ MOCK AUTH — never ship past scaffold

Day 0 auth is a **mock cookie session** (`docs/arch-docs/ADR-LeaveTrack-E001-Auth-Session-Strategy.md`).
The login form accepts **any** input; the `mock-role` cookie is the entire session.
This is **not** production auth. Day 1 replaces _how the cookie gets set_ (real provider) —
`proxy.ts`, `getSession()`, and the role guards keep their contracts. Do not build features that
depend on the mock (e.g. reading name/email from the login form).

## Project

LeaveTrack replaces email + spreadsheet leave tracking: employees submit requests and see balances,
managers approve **only their direct reports**, HR gets a 3-year auditable decision record.

- Requirements: `docs/brd/` → `docs/prd/` → `docs/arch-docs/` → `docs/dev-tasks/`
- Roles: `employee`, `manager`, `hr_admin`

## Stack

| Layer      | Choice                                                           |
| ---------- | ---------------------------------------------------------------- |
| App        | Next.js 16 App Router, TypeScript (strict), React 19             |
| DB         | Supabase Postgres via **pooler** (postgres.js, `prepare: false`) |
| Migrations | Raw SQL in `supabase/migrations/`, applied with the Supabase CLI |
| Validation | zod at every boundary                                            |
| Logging    | pino (`src/lib/logger.ts`)                                       |
| Tests      | Vitest                                                           |
| Hosting    | Vercel (app + Cron), Supabase (Postgres)                         |

Exact versions are pinned in `package.json` (no `^`/`~`). Add dependencies with an exact version.

## Layout

```
src/proxy.ts            route guard (Next 16 name — not middleware.ts)
src/app/                routes; api/ for route handlers
src/lib/auth/           session (mock), guards, cron secret, redirect sanitizing
src/lib/db/             pooled client + row types (mirror the migrations)
src/lib/errors/         AppError + response envelope
src/lib/env.ts          validated env (lenient in dev, strict in production)
src/lib/logger.ts       structured logger
src/lib/mock/           Day 0 mock data (UUIDs match supabase/seed.sql)
supabase/               migrations, seed, schema verification
knowledge/              standards, prompts, patterns
```

## Backend rules

1. **Every route handler is wrapped in `withErrorHandling`.** Every non-2xx response is
   `{ success: false, error: { code, message } }`; success is `{ success: true, data }`.
   Throw `AppError(code, message)` for expected failures — never return ad-hoc error JSON.
2. **Validate input with zod** before using it. A `ZodError` becomes `VALIDATION_ERROR` automatically.
3. **Authorization lives in SQL, not app logic.** Manager-scoped queries filter
   `WHERE u.manager_id = ${session.user.id}` in the query itself (BR-02 / US-04). Never fetch broadly
   and filter in TypeScript; never trust a client-supplied user or manager id.
   `assertRole()` / `requireRole()` are coarse gates only.
4. **No hard deletes, ever.** `leave_requests` use `is_deleted`; `audit_log` is append-only.
   The database enforces both with triggers — don't try to work around them.
5. **Every leave decision writes an `audit_log` row in the same transaction** (`sql.begin`).
6. **SQL only via postgres.js tagged templates** (`sql\`... ${value}\``). Never concatenate SQL strings.
7. **Use `getDb()`** (pooler URL). Never connect the app to the direct (5432) URL.
8. **Log with `logger`** (or a `logger.child({...})`). `console.*` fails lint. Never log cookies,
   tokens, or full request bodies.
9. **Config via `getEnv()`** — never read `process.env` elsewhere. New variables go in `env.ts` _and_
   `.env.example` with a comment.
10. `/api/jobs/*` is protected by the `CRON_SECRET` bearer check in `proxy.ts`; job handlers must be
    idempotent (US-07 AC2).

## Frontend rules

- Server components by default; `"use client"` only for interactivity.
- Read the session in server components with `getSession()` / `requireSession()` / `requireRole()` —
  no auth Context provider.
- Components take typed props; no data fetching inside presentational components.
- **No UI shell yet.** The design export hasn't been delivered. Keep markup semantic and unstyled;
  the design system (tokens, Tailwind, components) is added in a dedicated scaffold pass.
- Accessibility is not deferred: labels on every input, `role="alert"` for errors, keyboard-usable.
- Mobile first: 30% of staff are mobile-only (BR-05). Nothing may require horizontal scroll at 375px.

## Database rules

- One migration per change: `supabase/migrations/<YYYYMMDDHHMMSS>_<snake_name>.sql`.
- **Never edit a migration that has been applied anywhere.** Write a new one.
- Update `src/lib/db/types.ts` in the same PR as the migration.
- `supabase/seed.sql` stays idempotent (`on conflict do nothing`, fixed UUIDs).
- New tables: enable RLS (deny-by-default) and add indexes for every FK used in a filter.

## Security

- Never commit secrets: `.env*` (except `.env.example`) and `.mcp.json` are git-ignored.
- Security headers live in `next.config.ts`; don't loosen CSP without a comment explaining why.
- No CORS: the API is same-origin only.
- Post-login redirects go through `safeNextPath()`.

## Git

- Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`), enforced by commitlint.
- Branch per task: `feat/TASK-011-submit-leave-request`. Reference the task id in the PR.
- Pre-commit runs ESLint + Prettier on staged files (husky + lint-staged).

## Quality gates (must pass before a PR)

```
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
```

- Every user-story task ships tests mapped to its acceptance criteria (one test per AC minimum).
- Scoping (US-03 AC3, US-04) is tested with a user from **another team** (seed: Leo Garcia).
- Accrual (US-07) is tested for exact amounts and for idempotency.
