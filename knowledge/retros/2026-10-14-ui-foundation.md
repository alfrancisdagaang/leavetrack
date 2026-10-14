# Retro — UI foundation (2026-10-14)

Scope: Tailwind v4 tokens (navy + light grey, light-only), 7 shared components, role-aware app shell, restyled
login / dashboard / error / 404. Verified with the full gate, a local production run, and 375px / 320px / 1280px
screenshots (no horizontal overflow).

## Fixed during VALIDATE

| Severity | Issue                                                                                         | Fix                                                                       |
| -------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| FIX NOW  | Focus ring was navy on the navy header (2.14:1) — keyboard focus invisible in the nav         | `header :focus-visible` uses a white outline                              |
| FIX NOW  | Input border grey-300 on white was 1.65:1 (needs 3:1 for form-control boundaries)             | Controls use `border-grey-500` (5.82:1)                                   |
| —        | Stale `.next/` types still pointed at `src/app/dashboard/page.tsx` after the route-group move | Local cache only (git-ignored); `rm -rf .next` fixed it; CI is unaffected |

## Backlog

- [ ] **Active nav link** — the current page is not highlighted. Needs a small client component (`usePathname`); add when a second page exists.
- [ ] **Mobile header height** — at 375px the nav wraps to three rows (~300px of header). Consider a compact menu if it looks heavy on the demo device.
- [ ] **Secondary button border** (grey-300) is below 3:1; acceptable because the text label identifies the control, but revisit with a real design.
- [ ] **No component rendering tests** — only the nav logic is unit-tested (vitest runs in `node`, no jsdom). Add jsdom + testing-library if UI logic grows.
- [ ] **`.env.example` `DIRECT_URL` example** still shows the IPv6-only `db.<ref>.supabase.co` host; CI needs the Session pooler string (IPv4).
- [ ] **Health check 1s ping limit** is tight for a cold serverless connection (first request showed `db: "error"`, next showed `ok`). Consider a longer limit, and set the Vercel function region near Supabase (Mumbai).
