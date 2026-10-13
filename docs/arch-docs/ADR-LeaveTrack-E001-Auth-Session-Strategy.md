# ADR-LeaveTrack-E001 — Auth & Session Strategy

**Status:** Accepted

## Context
Day 0 (`/scaffold`) must produce a running app with zero external credentials — no real auth provider configured yet. But the app still needs role-gating (Employee / Manager / HR Admin) from commit one, since every page in the UI shell renders differently per role.

## Options Considered
1. **No auth at all on Day 0** — every route publicly accessible, role picked via a UI toggle.
   - Pros: simplest possible Day 0.
   - Cons: doesn't exercise the route-guard pattern the real app needs; Day 1 auth wiring becomes a bigger jump.
2. **Mock cookie session** — login form accepts any input, sets an httpOnly cookie holding a mock role, route guard reads it.
   - Pros: exercises the exact route-guard shape the real app will use; Day 1 just swaps the cookie's origin (real provider) not the guard logic.
   - Cons: slightly more Day 0 setup than option 1.
3. **Mock JWT in localStorage.**
   - Pros: familiar pattern.
   - Cons: not readable server-side without extra plumbing; server components can't gate on it directly.

## Decision
Option 2 — mock cookie session, per nexus's Day 0 convention (`/scaffold`'s "Mock auth pattern"). Cookie holds `mock-role`, 8h expiry. Route guard (Next.js `proxy.ts`) reads the cookie and redirects unauthenticated requests to login. Server components read the cookie directly for the current session — no Context provider needed.

## Consequences
- Positive: Day 1's real-auth task (wiring an actual provider) only replaces *how the cookie gets set* — the guard, the server-component read pattern, and every role-gated page stay untouched.
- Negative: until Day 1, "login" accepts any input — this must never ship past the scaffold stage, and `AGENTS.md` flags it explicitly so no developer mistakes it for production auth.
