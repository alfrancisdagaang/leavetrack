# Retro — page-load reliability (2026-10-17)

Scope: three reports from staging. The dashboard shows nothing until its slowest query returns. Request Leave loads slowly and
sometimes crashes (React #441). My balance returned a 503 because a trivial query hit its 8 s deadline. The first Request Leave
crash was a separate cause: **Vercel's `DATABASE_URL` had a stale password (`28P01`)**, fixed by the user in the environment
variable, not in code.

## Evidence

- `balance.last_accrual` (`select max(period) from accrual_ledger`, a tiny table) hit `deadlineMs: 8000` while `balance.summary`
  ran in parallel and finished. A slow query would not behave like this; a stuck pooled connection would. **Still not proven**
  (not reproducible locally); this is HANDOFF §0a candidate 1.
- #441 is React's "error occurred in the Server Components render, message omitted in production". The page threw because the
  query failed, and Request Leave had no `try/catch`.
- `getMySummary` runs 4 queries; the dashboard and Request Leave used only the balances part (one wasted query and a 50-row fetch each).
- Earlier claim corrected: layout and page do **not** make two Auth calls, because `getSession()` is wrapped in React `cache`.

## What changed

| Change                                                                                                                                                 | Why                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timedRead` in `src/lib/db/timed.ts`: 3 s first attempt, one retry with the rest of the 8 s on a deadline or a lost connection; reads only             | A dead connection costs about 3 s, not 8 s or a failure. The abandoned query keeps its slot, so the retry uses another connection (reasoned, not measured). |
| Not retried: `28P01`, `57014`, any other query error, any `AppError` (including a 503 the query raised itself)                                         | A second attempt cannot fix them; they should surface at once.                                                                                              |
| `client.ts`: `idle_timeout` 20 → 10, `max_lifetime` 300; `max` stays 5                                                                                 | Retire sockets the pooler may have closed. Best effort; the retry is the real guard.                                                                        |
| `getBalanceSummary` (balances only) used by the dashboard and Request Leave                                                                            | One query fewer on each page; less pool pressure.                                                                                                           |
| Dashboard: welcome block and button render at once; summary cards and calendar are separate `<Suspense>` sections (calendar keyed by month + rejected) | No more waiting for the slowest query. A failed section degrades alone.                                                                                     |
| Dashboard welcome subtitle no longer shows the pending count                                                                                           | It would have held the header back; the "Pending approvals" card carries the number.                                                                        |
| Request Leave: header at once, form streamed; a failed read shows an alert and a "Try again" link                                                      | No more #441 from a failed query.                                                                                                                           |
| Balance: header at once, body streamed; the accrual caption is optional                                                                                | A decorative query can no longer 503 the page.                                                                                                              |
| `prefetch={false}` on the dashboard's calendar links and "Request Leave" (here and on the balance page)                                                | No background burst of dynamic page requests.                                                                                                               |
| Approvals, audit, `session.find_user` and the two read API routes use `timedRead`                                                                      | Same retry on every read path. Writes stay unwrapped.                                                                                                       |

## Tests

`timed.test.ts` (+9: retry, double stall, remaining budget, lost connection, `57014`, `28P01`, own 503, no SQL in logs),
`dashboard/sections.test.ts`, `balance/balance-section.test.ts`, `requests/new/request-form-section.test.ts` (fallbacks and scoping).
Vitest only picks up `*.test.ts`, so the section tests call the async component and render the element with `renderToStaticMarkup`.

## Verification (2026-10-17)

- `lint`, `format:check` (4 files needed `prettier --write`: fixed), `typecheck`, `npm test`: 352 passed, 14 skipped (gated real-DB tests).
- `npm run build` passed, run in a throwaway copy because the user's `next start` held port 3000 and `.next`.
- **Smoke against a black-hole database** (accepts TCP, never answers; built copy on port 3002, mock login as employee):

| Page            | First byte | Total  | Result                                                           |
| --------------- | ---------- | ------ | ---------------------------------------------------------------- |
| `/dashboard`    | 79 ms      | 8.06 s | Welcome block at once; cards and calendar show "not available"   |
| `/balance`      | 21 ms      | 8.02 s | Header at once; alert with "Try again"                           |
| `/requests/new` | 27 ms      | 8.02 s | Header at once; alert with "Try again" (was an error page, #441) |

The log showed every read hit the 3 s deadline, then `Retrying read query` with 4997 ms left, then the final deadline at about 5 s:
8 s in total, as designed. No 503 or error page on any of the three.

- **Not covered by the smoke:** a retry that succeeds (a black hole never answers); that is covered by the `timedRead` unit test only.

## Not done / not proven

- That the stall is fixed. Check Vercel logs after deploy for `Retrying read query`, `Database query hit its deadline` and
  `Slow database query`; the deadline line should become rare and `Retrying read query` should appear in its place.
- **BACKLOG:** `session.find_user` runs before the shell, so a stalled user lookup still delays the first byte by up to 8 s (the retry
  shortens it to about 3 s on a dead connection). Moving it behind the shell would need a different session design.
- **BACKLOG:** with the whole database down, each page still takes about 8 s to finish its sections (the first byte is instant).
- Streaming approvals and audit (they only got the retry).
- `28P01` shows the generic error page; a dedicated "unavailable" page is still backlog.
- The first deadline of 3 s retries a genuinely slow cold query once; the total stays 8 s.
