# LeaveTrack

Self-service leave requests, scoped manager approval, and an auditable decision record.

> **Sign-in is real** (Supabase Auth, email + password). A labelled mock login still exists for
> local development only, behind `ALLOW_MOCK_LOGIN`. See `AGENTS.md`.

## Prerequisites

- Node.js **22** (`.nvmrc`; ≥ 22.12)
- npm 10+
- Optional: PostgreSQL client (`psql`) or Docker, to run migrations locally

## Quick start

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` (see [Environment](#environment)), open http://localhost:3000
→ you'll be redirected to `/login`, then sign in with a demo account (see below).

## Signing in (demo accounts)

All demo accounts share one password: **`password123`**. All data is fake. This password is for
the demo project only; never reuse it anywhere real.

| Role       | Name         | Email                             | What they can do                                     |
| ---------- | ------------ | --------------------------------- | ---------------------------------------------------- |
| `hr_admin` | Sam Okafor   | `sam.okafor@leavetrack.example`   | HR: all requests, audit record, leave policies       |
| `manager`  | Marco Santos | `marco.santos@leavetrack.example` | Approves requests from his direct reports            |
| `employee` | Elena Cruz   | `elena.cruz@leavetrack.example`   | Submits requests and sees her balance (Marco's team) |

1. Open `/login`.
2. Enter the email and the shared password.
3. To switch role, open the account menu in the header, choose **Sign out**, and sign in as another account.

Other accounts: Hana Reyes (`hana.reyes@…`, `hr_admin`), Priya Nair (`priya.nair@…`, `manager`),
Jun Bautista (`jun.bautista@…`, `employee`, Marco's team), Leo Garcia (`leo.garcia@…`,
`employee`, Priya's team: use him to check that managers only see their own reports).

To reset the shared password, see `knowledge/runbooks/seed-auth-users.md`.

## Scripts

| Command                           | What it does                                             |
| --------------------------------- | -------------------------------------------------------- |
| `npm run dev`                     | Dev server                                               |
| `npm run build` / `npm start`     | Production build / serve                                 |
| `npm run lint`                    | ESLint                                                   |
| `npm run format` / `format:check` | Prettier write / check                                   |
| `npm run typecheck`               | `tsc --noEmit`                                           |
| `npm test`                        | Vitest                                                   |
| `npm run db:push`                 | Apply migrations to the linked Supabase project (Day 1+) |

## Environment

Copy `.env.example` to `.env.local` and fill in what you need. Every variable is documented there.
Development tolerates missing values; `APP_ENV=production` requires `DATABASE_URL` and `CRON_SECRET`.

- `DATABASE_URL` must be the Supabase **pooler** URL (port 6543).
- `DIRECT_URL` (port 5432) is only for migrations.

## Database

Migrations are raw SQL in `supabase/migrations/`; seed data is `supabase/seed.sql` (idempotent).

Run against any local Postgres (e.g. Docker):

```bash
docker run -d --name leavetrack-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17
export PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres PGDATABASE=postgres
for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -f "$f"; done
psql -v ON_ERROR_STOP=1 -f supabase/seed.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/verify_schema.sql
```

Then set `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres` to see
`db: "ok"` from `GET /api/health`.

The schema enforces retention rules itself: hard `DELETE` on `leave_requests` and any
`UPDATE`/`DELETE` on `audit_log` raise an error.

## Auth

- `/login` signs in with Supabase Auth (email + password). The `users` row found by email decides the
  role (`employee` | `manager` | `hr_admin`). See `docs/arch-docs/ADR-LeaveTrack-E003-Real-Sign-In.md`.
- Only when `ALLOW_MOCK_LOGIN=true` (default on in development, off elsewhere) does the labelled
  mock login set an httpOnly `mock-role` cookie (8h). Keep it off on any public URL.
- `src/proxy.ts` redirects pages to `/login` and returns a 401 envelope for APIs without a session.
- `/api/health` is public; `/api/jobs/*` requires `Authorization: Bearer $CRON_SECRET`.

## API conventions

```json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "FORBIDDEN", "message": "..." } }
```

## CI

`.github/workflows/ci.yml`: lint, format, typecheck, test, build; migrations + seed (twice) +
schema verification on a throwaway Postgres; `supabase db push` on `main` only when the
`SUPABASE_DB_URL` secret is configured.

## Project docs

`docs/` (BRD → PRD → architecture → dev tasks), `AGENTS.md`, `knowledge/`.
