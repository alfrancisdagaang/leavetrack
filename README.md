# LeaveTrack

Self-service leave requests, scoped manager approval, and an auditable decision record.

> **⚠ Day 0 scaffold — mock auth only.** Sign-in accepts any input and stores only a role in a
> cookie. Real authentication is wired in Day 1. See `AGENTS.md`.

## Prerequisites

- Node.js **22** (`.nvmrc`; ≥ 22.12)
- npm 10+
- Optional: PostgreSQL client (`psql`) or Docker, to run migrations locally

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 → you'll be redirected to `/login`. Pick a role and sign in.
No `.env` file, database, or credentials are needed for Day 0.

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

## Auth (Day 0 mock)

- `/login` sets an httpOnly `mock-role` cookie (`employee` | `manager` | `hr_admin`, 8h).
- `src/proxy.ts` redirects pages to `/login` and returns a 401 envelope for APIs without it.
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
