# Retro: TASK-063, organization chart reads scoped by role in SQL (EPIC-11)

Built and validated locally, **not committed, not pushed**. Backend only: no page, migration, role or required-feature change; nothing under `docs/` touched. The Organization tab that shows these reads is TASK-064.

## What shipped

- `src/lib/leave/org.ts`, four reads, each ONE statement, each taking the session user's id (never a client id). A node is `{ id, name, role, reports }`; the manager tree adds `parentId` and `depth`. No email, no leave data.
  - `getEmployeeOrg`: the viewer's manager, themself, their direct reports (the manager row is found through the viewer's own `manager_id`, so a peer cannot be selected). No role check: it only ever returns the viewer's own neighbourhood.
  - `getManagerOrg`: the viewer must be a `manager` (checked in the SQL); a recursive walk down `manager_id`, depth cap 6, a `path` array that starts with the viewer (so a loop back to the viewer ends too), at most 200 people cut shallowest-first (a parent always precedes its reports), and the true total counted before the cut.
  - `getOrgChildren` / `getOrgRoots` (one statement, roots = no parent): the viewer must be an `hr_admin` in the SQL, 50 per page, page clamped in SQL, a `reports` count per node. An unknown parent and a person with no reports give the identical empty page.
- `GET /api/org/children?parent=&page=`: `withErrorHandling`, `assertRole("hr_admin")` first, zod (`org-schema.ts`, a new file so the 66-degree `schemas.ts` is untouched), `no-store`. Documented exception to AGENTS.md rule 3 (HR's scope is the company; the client `parent` is only a lookup key).

## Validation

- **Gate (exit codes read):** lint 0, prettier 0, tsc 0, `npm test` 0 (**1,094 passed, 180 skipped**, gated), build 0 on a throwaway copy of the final code without `.env.local`.
- **Unit tests (26):** one statement and the bound values per read, the role checks, the cycle guard, caps and count-before-limit in the SQL text, no email or leave columns, the row mapping, truncation, and the route (401, 403 for employee and manager with nothing read, 400 for six bad queries, the viewer is always the session user and a client `viewerId` is ignored).
- **Gated real-database test (16, PostgreSQL 18.4):** AC1 to AC5, with another team (a manager and employee under a second manager), a peer, a 7-deep chain, 210 reports, 55 children for paging, a two-person loop, and a moved person.
- **Mutation proofs (10 of 10 caught, file restored and `cmp`'d each time):** manager role check dropped, HR role check dropped, cycle guard dropped (duplicates appear until the depth cap), depth cap dropped, row limit dropped, total counted after the cut, employee read returning peers, `email` selected on HR pages, HR page not clamped, walk starting from the manager's manager. One database was reused across runs (the test judges by its own random ids, so a fresh database is not needed).
- **Real route over HTTP** (production build, seeded PostgreSQL, mock cookie): HR gets Hana's reports (Marco 2, Priya 1), Priya's reports (Leo only), an empty page for an unknown parent and for a person with no reports (identical), page 9 clamps to page 1; employee and manager get 403 and no session 401, all in the envelope; missing parent and page 0 give VALIDATION_ERROR; a client `viewerId` changes nothing; `cache-control: no-store`; no email anywhere in a body.
- **Load check (scratch database only, 30 runs each, local engine with no network latency):**

  | Read                                                                               | 800 users              | 1,400 users (one manager with 600 reports) |
  | ---------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------ |
  | HR roots, children of the root, of a director, of the biggest manager (page of 50) | 0.16 to 0.18 ms median | 0.16 to 0.33 ms                            |
  | Manager subtree (a director; the biggest manager, capped at 200)                   | 0.52 and 0.30 ms       | 0.57 and 0.91 ms                           |
  | Employee neighbourhood                                                             | 0.21 ms                | 0.21 ms                                    |

  The query deadline is 8,000 ms. EXPLAIN: the joins and every report count use `users_manager_id_idx`; the recursive step does a single hash join over a sequential scan of `users` (22 buffers at 1,400 rows), a planner choice at this size. Worth re-checking if the table grows by orders of magnitude.

- **Not run:** GitHub Actions and Vercel (nothing pushed), real Supabase latency for these reads, a page that calls them (TASK-064), the real sign-in path (mock cookie only).

## Decisions taken (defaults, no objection)

1. Manager and HR reads refuse the wrong role in the SQL; the employee read has no role check (own neighbourhood only).
2. An unknown parent is an empty page, never a not-found.
3. A closed loop where everyone has a manager cannot be reached from HR's roots; not fixed (no screen can create a loop until EPIC-8).

## Backlog (nothing blocking)

- On the employee read, the manager node's `reports` counts the viewer's peers too. It is a number only; no peer is named. Hide it if that is too much.
- The `reports` count of the viewing manager's own manager node is likewise a whole-team number.
- Cycles are survivable but not detectable by HR; a data check would need its own read.
- The 800-user figures are from an embedded engine on this Mac: repeat on staging before relying on them.
