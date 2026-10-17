# Coding Standards — LeaveTrack

Expands on `AGENTS.md`. When the two disagree, fix whichever is wrong in the same PR.

## TypeScript

- `strict` + `noUncheckedIndexedAccess`. No `any`; use `unknown` and narrow.
- `import type` for type-only imports (lint-enforced).
- Path alias `@/` → `src/`. No deep relative imports (`../../..`).
- Prefer `type` aliases and `as const` unions (see `USER_ROLES` in `src/lib/db/types.ts`) over TS `enum`.
- Pure logic lives in `src/lib/**` as plain functions so it can be unit-tested without Next.js.
- File names: kebab-case. React components: PascalCase exports.

## Route handlers

```ts
import { assertRole } from "@/lib/auth/guards";
import { ok, withErrorHandling } from "@/lib/errors/respond";

export const POST = withErrorHandling(async (request) => {
  const session = await assertRole("employee");
  const input = CreateLeaveRequest.parse(await request.json()); // ZodError → 400
  // ... sql with session.user.id, never a client-supplied user id
  return ok(created, { status: 201 });
});
```

- Error codes: `VALIDATION_ERROR` 400, `UNAUTHORIZED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404,
  `CONFLICT` 409, `INTERNAL` 500. Add a code in `app-error.ts` only with a matching status.
- Not-your-resource (US-03 AC3) is `FORBIDDEN`; a request outside the manager's scope must never be
  returned in a list either.

## SQL

- postgres.js tagged templates only. Dynamic identifiers use `sql(identifier)`, never interpolation.
- Scoping in the `WHERE` clause:

  ```ts
  await sql`
    select r.* from leave_requests r
    join users u on u.id = r.user_id
    where u.manager_id = ${session.user.id}
      and r.is_deleted = false
      and r.status = 'pending'`;
  ```

- Multi-statement writes (decision + balance + audit) use `sql.begin(async (tx) => { ... })`.
- Money-like quantities (days) are `numeric(6,2)`; postgres.js returns them as strings — convert
  deliberately, never with float arithmetic on accrual totals.
- Always exclude `is_deleted = true` from active views; the HR audit view excludes them by default and includes them, flagged, only when HR asks.

## Migrations

- `supabase/migrations/<UTC timestamp>_<snake_name>.sql`; forward-only; never edit an applied one.
- Constraints over app checks where possible (check, unique, FK, triggers).
- New table checklist: PK uuid, FKs with explicit `on delete`, indexes on filtered FKs, RLS enabled.
- Extend `supabase/tests/verify_schema.sql` with an assertion for every new invariant.

## Logging

- `logger.info|warn|error({ context }, "message")` — structured fields first, message second.
- Errors: `logger.error({ err }, "...")` so pino serializes the stack.
- `warn` for expected client failures (4xx), `error` for unexpected (5xx).
- Never log: cookies, authorization headers, secrets, full request bodies, leave `reason` text.

## Testing

- Vitest; tests sit next to the code (`foo.ts` → `foo.test.ts`).
- One test per acceptance criterion minimum, named after it (`"US-04 AC1: ..."`).
- Scoping tests use a user from another team (seed: Leo Garcia under Priya Nair).
- Accrual tests assert exact decimal results and idempotency (run twice → same balance).
- Mock the logger in unit tests (`vi.mock("@/lib/logger", ...)`); never hit a real database in unit tests.

## React / UI

- Server components by default; client components are leaves.
- Props interfaces are explicit and serializable so Day 1 can swap mock data for real data.
- Every input has a `<label>`; errors use `role="alert"`; buttons show pending state.
- Prototype UI: style with the tokens in `src/app/globals.css` and the shared components in
  `src/components/ui/` (Tailwind v4). No hard-coded colors; reuse a component before writing a new one.
  A real design export, when it arrives, restyles the tokens rather than every page.

## Environment-derived behavior (learned in Day 0 VALIDATE)

- Anything that must be safe in a production **build** keys off `NODE_ENV` (set by Next.js),
  not only `APP_ENV` (set by humans, can be forgotten). Examples: `Secure` cookies, never loading
  devDependencies like pino-pretty at runtime.
- `APP_ENV` stays the switch for _deployment intent_ (staging vs production config strictness).
- **Library cookie defaults are not security settings** (learned in TASK-025): `@supabase/ssr` sets
  `httpOnly: false` and no `Secure`. Pass `supabaseCookieOptions()` as `cookieOptions` wherever a
  Supabase server client is created. A test stub that writes `{ httpOnly: true }` itself proves
  nothing; assert what the code asks the library for.
- Secrets reach logs by being passed as fields, not by bad luck: `src/lib/security-guards.test.ts`
  fails on a service-role identifier in `src` or a cookie/token/header/body/`reason` log field.

## Catching errors around Next request APIs (learned in TASK-021 VALIDATE)

- `cookies()`, `headers()`, `redirect()` and `notFound()` signal "dynamic render" or navigation by **throwing**. A
  `try/catch` around code that may call them must call `unstable_rethrow(err)` (from `next/navigation`) first, or it
  swallows the signal (the build logged `DYNAMIC_SERVER_USAGE` as "Session resolution failed").

## Tooling notes (Windows + npm)

- `.gitattributes` forces LF — husky hooks with CRLF break on Linux CI and macOS.
- Hooks must be committed executable: `git add --chmod=+x .husky/*` (core.fileMode is off on Windows).
- Before pinning, check `npm view <pkg> dist-tags` — semver ranges picked from memory go stale
  (vitest `^4` crashed npm 10's resolver; current stable was 5.x).
- When moving a package up a major version, check peer ranges of the plugins that consume it (e.g. ESLint 10
  is blocked by eslint-plugin-react; TypeScript ≥ 6.1 by typescript-eslint).
