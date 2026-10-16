# Retro — TASK-024 script to create Supabase Auth users (2026-10-16)

Scope: US-09 / EPIC-2. `npm run auth:seed` creates (or resets the password of) one confirmed Supabase Auth account per email in
`supabase/seed.sql`. Local only: the service-role key, the shared demo password and the project URL are read from the
person's own shell, never from `env.ts`, `.env` files or Vercel. A bare run is a dry run; `--yes` writes. With
`SUPABASE_ANON_KEY` set it also signs in as each user to prove it. Runbook: `knowledge/runbooks/seed-auth-users.md`.

## Acceptance criteria

| AC                                                               | Proof                                                                                                                                                                                      | Result      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| AC1 one Auth account per seeded email, each able to sign in      | Unit: email list parsed from the real `seed.sql` is exactly the seven; missing accounts are created with `email_confirm: true`. The script's own sign-in check covers "able to sign in".   | PASS (live) |
| AC2 running twice creates no duplicates and updates the password | Unit with an in-memory admin stub: second run over all seven gives 7 created then 7 updated, 7 accounts total; mixed-case email matched; an account past page 1 of the list is found.      | PASS (live) |
| AC3 key and password never in the repo, logs or app bundle       | Unit: errors carry the Supabase code, never the password; input errors never echo values. Grep of the repo: only variable names; `.next` has no match. Script prints only host and emails. | PASS        |

## Verification

- `lint`, `format:check`, `typecheck`, `npm test` (309 passed, 14 skipped = gated real-DB tests) and `npm run build` (port 3000
  checked free in the same command) all pass.
- Dry run with fake values prints the host and the seven emails and writes nothing (exit 0); a bad URL and missing variables exit 1
  with messages that echo no value.
- Graph: nothing in `src/` references `scripts/`; no boundary crossings.
- **Live run (2026-10-16, user's shell, project `lbgnomoqtcttwuihreeb`):** first `--yes`: 6 created, 1 updated (Elena, hand-made),
  7 of 7 `sign-in ok`, 0 failed. Second `--yes`: 0 created, 7 updated, 7 of 7 `sign-in ok`, 0 failed. The output held no secrets.
- **Still to eyeball:** Supabase → Authentication → Users shows exactly seven rows.

## Issues

| Severity | Issue                                                                                                                                   | Fix                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| FIX NOW  | Node printed a `MODULE_TYPELESS_PACKAGE_JSON` warning on every run.                                                                     | `--disable-warning` in the npm script (no `"type": "module"`). |
| BACKLOG  | Real `auth.admin` behaviour (pagination limits, weak-password codes, rate limits) is only stubbed.                                      | Check on the first live run.                                   |
| BACKLOG  | The password reaches the script through an environment variable, so it may sit in shell history if typed inline.                        | Runbook sets `$env:` interactively and clears it afterwards.   |
| BACKLOG  | The email list is parsed from `seed.sql` with a regex; a reformatted insert block would fail loudly (tested) rather than silently skip. | Accepted.                                                      |

## Deliberate choices

- The script reads `process.env` directly: a documented exception to AGENTS.md rule 9, so the service-role key never enters `env.ts`.
- Dry run by default; `--yes` is required to write, and the target host is printed first, to catch a wrong project.
- `updateUserById` also sets `email_confirm: true`, so a hand-made unconfirmed account becomes usable.
