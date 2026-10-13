# Retro — Day 0 scaffold (2026-10-13)

Scope: `/scaffold` Option B — infrastructure, mock auth, migrations; UI shell deferred (no design export).

## Fixed during VALIDATE

| Severity | Issue                                                                                                                    | Fix                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| FIX NOW  | CI pinned `actions/checkout@v4` / `actions/setup-node@v4`, three majors behind (latest v7.x)                             | Bumped to `@v7`                                                       |
| FIX NOW  | Logger chose pino-pretty (a devDependency) from `APP_ENV`; a production deploy with `APP_ENV` unset would try to load it | Pretty output keyed on `NODE_ENV === "development"` (only `next dev`) |
| FIX NOW  | Session cookie `Secure` derived only from `APP_ENV`; same unset-`APP_ENV` deploy would issue non-Secure cookies          | `Secure` whenever `NODE_ENV === "production"` too; test added         |
| FIX NOW  | Health-check DB ping left a 1s timer pending after every successful ping                                                 | Timer cleared in `finally`                                            |

## Backlog

- [ ] **Design export** — UI shell, design tokens, Tailwind, `knowledge/` design spec. Blocked on `docs/designs/`.
- [ ] **ADR-LeaveTrack-E002 missing** — the arch doc cites it for accrual idempotency (US-07 AC2). Write it before the accrual task (suggested: `accrual_runs(period)` with a unique constraint).
- [ ] **`npm audit`: 5 high (dev-only)** — `braces@3.0.3` ReDoS via `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch`. No patched `braces` exists; only our own lint globs reach it. `npm audit --omit=dev` is clean. Re-check when eslint-config-next updates.
- [ ] **ESLint 9 is flagged deprecated by npm** — ESLint 10 is blocked by `eslint-plugin-react`, `jsx-a11y`, `import` (peer ranges stop at 9). Upgrade when eslint-config-next supports 10.
- [ ] **lint-staged held at 16.4.0** — 17.x needs Node ≥ 22.22.1; this machine has 22.19.0. Upgrade Node, then lint-staged.
- [ ] **CSP uses `'unsafe-inline'`** for scripts/styles — move to per-request nonces with the UI shell.
- [ ] **`APP_ENV` not enforced on Vercel** — a production deploy without `APP_ENV=production` runs with lenient env validation. Add a startup check (e.g. `VERCEL_ENV === "production"` ⇒ require `APP_ENV=production`) when deployment is set up.
- [ ] **`server-only` guard** — `src/lib/db/client.ts` has no import-time guard against client bundling. Add the `server-only` package (pinned) when the first client component lands near data code.
- [ ] **`resolve_package_versions` MCP tool fails on Windows** (`WinError 2` — likely spawning `npm` without `npm.cmd`/shell). Versions were resolved directly against the npm registry instead. Report upstream.
- [ ] **Knowledge graph unavailable** — neither graphify nor codegraph is set up, so VALIDATE's blast-radius check was skipped.
