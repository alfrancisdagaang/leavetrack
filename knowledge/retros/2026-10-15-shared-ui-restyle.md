# Retro — shared UI restyle to the dashboard tokens (2026-10-15)

Scope: `Card`, `Button`, `PageHeader`, form fields, `Badge`, `Alert`, the card skeleton and the page bodies' text and row classes
moved from the old navy/grey look to the Figma dashboard tokens (`brand-*`, `ink`, `ink-muted`, `page`, `shadow-tile`,
`rounded-tile`). No behaviour, API or data changes. The Figma file only has the dashboard, so forms, buttons and lists are
extrapolated from it, not pixel-matched.

## Verification

- `lint`, `format:check`, `typecheck`, `npm test` pass (209 passed, 2 skipped = the gated real-database tests).
- `npm run build` was **not** run: the user's `next start` was listening on port 3000.
- Headless Chrome (CDP) against `next dev` on port 3001 (stopped afterwards), as employee, manager and HR on every page for
  that role, at 320, 375 and 1280 px: **no horizontal overflow, no visible control under 44 px** (21 page/width combinations).
  Screenshots reviewed by eye: request form and audit at 375, approvals and HR dashboard at 1280.
- Not verified: other pages at every width by eye (measured only), real touch devices, pixel comparison with Figma, `/login`,
  error and 404 pages (restyled by class swap, not opened).

## Fixed during VALIDATE

| Severity | Issue                                                                                             | Fix                                                     |
| -------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| FIX NOW  | `ink-muted` on the `page` tint was 4.44:1, under the 4.5:1 AA line (it was already in use)        | Darkened to `#5b6c86` (4.91:1 on page, 5.34:1 on white) |
| FIX NOW  | `skeleton.test.ts` asserted the old `shadow-sm`; the balance row skeleton still had the old style | Row skeleton now matches the real row; counts updated   |

Contrast now (computed): white on `brand-500` 4.93, white on `brand-600` 6.64, `brand-600` on `brand-50` 5.80, `ink` on `page`
12.44, control border on white 4.82.

## Found, not caused by this change

- **Header wraps at 1280 px for manager and HR.** With four or five nav items the avatar, name and Sign out drop onto a second
  row under the nav (employee, with three items, fits). Introduced by the Figma dashboard commit `5afddfb` (`app-shell.tsx`
  is untouched here); that commit measured overflow and screenshots at 1672 px only. Needs a decision: it changes the
  Figma-based shell.

## Backlog

- [ ] Dashboard cards: the "Open" arrow sits bottom-right on some cards and top-right on others (HR dashboard at 1280).
- [ ] Dates still render as ISO (`2026-11-02 to 2026-11-04`) on approvals and balance.
- [ ] No component rendering tests; the restyle was checked by screenshots only.
