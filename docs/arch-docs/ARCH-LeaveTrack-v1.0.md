# Architecture Document — LeaveTrack v1.0

Traces to: `docs/prd/PRD-LeaveTrack-v1.0.md`

## Stack
- **Frontend/Backend:** Next.js 16 (App Router), TypeScript.
- **Database:** Postgres via Supabase.
- **Auth (Day 0):** mock cookie session — see `ADR-LeaveTrack-E001`. Real provider wired in Day 1.
- **Deployment target:** Vercel (app), Supabase (managed Postgres).

Rationale: the team already runs Next.js + Supabase on other projects (fits nexus's Day 0 mock-auth-mock-data pattern directly); no NFR here demands anything heavier.

## Data Model

```
users            (id, name, email, role[employee|manager|hr_admin], manager_id nullable FK -> users.id)
leave_types      (id, name, tracks_balance boolean)          -- seeded: Vacation, Sick, Unpaid
leave_policies   (id, user_id FK, leave_type_id FK, accrual_per_month numeric)
leave_balances   (id, user_id FK, leave_type_id FK, balance numeric, updated_at)
leave_requests   (id, user_id FK, leave_type_id FK, start_date, end_date, reason,
                  status[pending|approved|rejected], decided_by FK -> users.id nullable,
                  decided_at nullable, is_deleted boolean default false, created_at)
audit_log        (id, leave_request_id FK, actor_id FK, action, occurred_at)
accrual_ledger   (id, user_id FK, leave_type_id FK, period date [first of a UTC month], amount, created_at)
                 -- UNIQUE (user_id, leave_type_id, period); append-only; the accrual idempotency guard
```

- `leave_requests.is_deleted` — **soft delete only**, per BR-04 (3-year retention). No hard-delete path exists anywhere in the codebase.
- `users.manager_id` is the sole source of truth for the scoped-visibility rule (US-04). A manager's queue query always filters `WHERE manager_id = :current_user_id`.

## API Design (selected)
| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | /api/leave-requests | Employee | US-01. Validates date range server-side (AC2). |
| GET | /api/leave-requests?scope=mine | Employee | US-02 balance context. |
| GET | /api/leave-requests?scope=team | Manager | US-04 — server-side filter on `manager_id`, never client-side. |
| POST | /api/leave-requests/:id/decision | Manager | US-03. 403 if requester is not a direct report (AC3). |
| GET | /api/audit/:userId | HR Admin | US-05. Reads soft-deleted-excluded, never hard-deleted, rows. |
| GET, POST | /api/jobs/accrual | System (cron) | US-07. Vercel Cron sends GET; POST for manual runs. Idempotent — see ADR-LeaveTrack-E002. |

Error format: `{ success: false, error: { code, message } }` on every non-2xx response, per AGENTS.md convention.

## Security
- Every manager-scoped endpoint enforces the `manager_id` filter in the query itself, not in application logic that could be bypassed — this is the direct implementation of PRD NFR "enforced server-side, never client-side only."
- Session cookie is httpOnly, 8h expiry (Day 0 mock auth pattern; unchanged shape when real auth replaces it in Day 1).

## Deployment Topology
- Single Next.js app on Vercel, single Supabase Postgres instance (pooled connection, not direct).
- Monthly accrual job (US-07) runs as a scheduled Vercel Cron (GET, 00:00 UTC on the 1st, `vercel.json`) hitting `/api/jobs/accrual`.

## Open Questions
- Should `leave_policies` support mid-year policy changes (e.g., a promotion changing accrual rate)? Flagged for Sprint 2 — not required for Q3 launch (BRD scope).
