# Retro — TASK-025 CSP and security review (2026-10-17)

Scope: EPIC-2 task. AC1 sign-in works under the production CSP with no console violations. AC2 session cookies are httpOnly and
Secure on a non-development `APP_ENV`. AC3 grep and tests show no token or cookie value is logged and no service-role key is
referenced in `src`.

## Findings

| AC  | Finding (read from the code and the library, then proved by tests)                                                                                                                                                                                                   | Result before | After                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------- |
| AC2 | `@supabase/ssr` 0.12.7 defaults to `httpOnly: false` and sets no `Secure`; both clients passed its options through unchanged. ADR-E003 said "httpOnly cookies", which was not true. Only the mock cookie had both flags.                                             | FAIL          | `supabaseCookieOptions()` passed as `cookieOptions`         |
| AC2 | The existing proxy test stub wrote cookies with `{ httpOnly: true }` itself, so it passed while the real library did the opposite.                                                                                                                                   | hidden        | the test now asserts what the proxy asks the library for    |
| AC3 | `SERVICE_ROLE` appears only in `scripts/` and `.env.example` (shell-only by design). `src/lib/env.ts` mentions it in a comment saying it is never an app variable. No `NEXT_PUBLIC_` variable is named like a secret.                                                | pass          | locked by `security-guards.test.ts`                         |
| AC3 | The redact list used `*.password` and `*.token`, which pino matches one level down only: a top-level `{ token }`, `{ cookie }` or any `access_token` / `refresh_token` / `authorization` was not redacted. No code logged one, so nothing leaked; the net had holes. | latent gap    | `REDACT_PATHS` covers top level and one level, 6 keys       |
| AC1 | Nothing in the browser calls Supabase: `createBrowserClient` is unused, every Auth call is server-side, sign-in is a form post under `form-action 'self'`. `connect-src 'self'` is enough, so adding the Supabase origin would only loosen the CSP.                  | no change     | comment in `next.config.ts` records why; no directive moved |

## What changed

- `src/lib/supabase/cookie-options.ts` (new): `isSecureCookie` (the one `Secure` rule, now also used by the mock cookie) and
  `supabaseCookieOptions` (`httpOnly`, `Secure` unless local dev, `sameSite: lax`, `path: /`; lifetime left to the library).
- `server.ts` and `proxy.ts` under `src/lib/supabase/`: pass it as `cookieOptions`.
- `logger.ts`: exports `REDACT_PATHS`, wider.
- Tests: `cookie-options.test.ts`, `server.test.ts`, `logger.test.ts`, `security-guards.test.ts`, and the proxy test.
- Docs: ADR-E003 update, a coding-standards rule, the CSP comment.

## Notes

- The first run of the service-role guard flagged `env.ts` for its explanatory comment; the guard now matches identifiers
  (`SERVICE_ROLE`, `serviceRole`), not prose. A planted violation (a service-role identifier and `logger.warn({ cookie })` in a
  temporary file) made both guards fail, then the file was removed.
- Existing browsers keep the old, non-httpOnly cookie until the next token refresh or a new sign-in rewrites it.

## Verification, not done by tests

Run on 2026-10-17 against `517ce12` plus this task, in a throwaway copy (the user's server held port 3000), production build,
`APP_ENV=staging`, mock login on, no database:

- **Real library, fake Auth server** (`@supabase/ssr` 0.12.7, password sign-in, only flags printed): without `cookieOptions` the
  `sb-*-auth-token` cookie came out `httpOnly=false`, `secure=undefined`; with ours `httpOnly=true`, `secure=true`, `sameSite=lax`.
  This is the proof that the library honours the override. It does not prove that the code passes it: the unit tests do that.
- **Response headers (production build):** CSP without `unsafe-eval`, `connect-src 'self'`, `form-action 'self'`,
  `frame-ancestors 'none'`; HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` present.
- **Headless Chrome through the DevTools protocol:** `/login` loaded, mock sign-in submitted, landed on `/dashboard`, **no CSP
  violation and no console error** except a `404` for `/favicon.ico` (pre-existing, not CSP). The `mock-role` cookie is
  `HttpOnly`, `Secure`, `SameSite=Lax`, and `document.cookie` shows no cookies to page scripts.
- **Server log of that run:** only "The database is not configured" warnings; a search for cookie, bearer and JWT patterns found nothing.
- **Not verified:** a real Supabase sign-in (it needs the shared demo password, which is never in chat). The user should sign in on
  the deployment with DevTools open and confirm (1) no CSP violation in the console, (2) in Application, Cookies, the
  `sb-*-auth-token` cookie shows `HttpOnly` and `Secure`. Sign out and in once after deploying: an existing browser keeps its
  old cookie until the token refreshes.
- **Live check, partly reported (2026-10-17):** after signing in with a real demo account the user typed `document.cookie` in
  DevTools and got `''`, which fits an HttpOnly session cookie (before the fix it would have listed `sb-*-auth-token`). The
  Cookies table (HttpOnly, Secure, SameSite) and the Console (CSP errors) were **not reported**, so AC1 and AC2 stay unconfirmed
  on the live site until they are.

## Backlog

- **`/favicon.ico` returns 404**, so every page logs one console error. It is not a CSP problem, but it makes a "clean console"
  check look dirty. Fix: add an app icon (for example `src/app/icon.svg` from `public/icons/leaf-logo.svg`).
- **`script-src` still allows `'unsafe-inline'`** (Next's bootstrap scripts). Nonce-based CSP is already noted in `next.config.ts`;
  httpOnly cookies now limit what a script injection could steal, but do not stop it.
- **Session length** is not set by this app: the Supabase cookie's `maxAge` is the library's 400 days and the real limit is the
  Supabase project's JWT expiry and refresh settings (dashboard). The mock cookie lasts 8 hours. Decide whether to time-box it.
