# Retro — sidebar shell, profile dropdown and dashboard cards (2026-10-15)

Scope: TASK-023 (reworded) and the first slice of the Figma dashboard (file `GrKk5YyfJcDRdPBr7xXTF9`, frames 14:8878, 14:9401,
14:9931, 14:9946, 14:9981, 14:9698). The top header is replaced by a left sidebar (collapsible on desktop, a drawer below
`lg`), a slim top bar with an account dropdown (name, role, email, Sign out), and the welcome block with four summary cards.
The calendar, upcoming leave, recent activity and the request detail page are later slices.

## Acceptance criteria (TASK-023)

| AC                                                                                                 | Proof                                                                                                                           | Result |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------ |
| AC1 sidebar shows only the role's items and highlights the current page                            | `nav.test.ts`, `app-frame.test.ts`; Chrome: employee 3, manager 4, HR 5 items                                                   | PASS   |
| AC2 avatar shows the signed-in email and Sign out; keyboard-usable, `aria-expanded`, Escape closes | Chrome: opens, shows email and Sign out, Escape closes and focus returns, outside click closes, Sign out ends the session       | PASS   |
| AC3 collapsible on desktop, a drawer on mobile, 44px targets                                       | Chrome: 232 to 72px; drawer is a modal dialog, focus to Close, Tab stays inside (12 presses), Escape, overlay and link close it | PASS   |
| AC4 no header wrap at 1280px; no horizontal overflow at 375 and 320px for employee, manager and HR | Chrome: 42 role/page/width combinations (320, 375, 768, 1024, 1280, 1440): no overflow, no visible control under 44px           | PASS   |
| AC5 every page still calls `requireSession()` or `requireRole()`                                   | grep of all five pages; the layout also calls `requireSession()`                                                                | PASS   |

## Verification

- `lint`, `format:check`, `typecheck`, `npm test` pass (226 passed, 2 skipped = the gated real-database tests).
- Headless Chrome (CDP) against `next dev` on port 3001, stopped afterwards. Screenshots reviewed against Figma by eye: manager
  dashboard at 1280 and 375/320, the drawer, the dropdown, approvals at 1024, balance at 1280.
- `npm run build` was **not** run (see below). Not verified: employee and HR dashboards by eye (measured only), real touch
  devices, pixel comparison with Figma, the collapsed rail's hover tooltips, `/audit` and the request form at every width by eye.

## Fixed during VALIDATE

| Severity | Issue                                                                                        | Fix                                                                                  |
| -------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| FIX NOW  | At 320px the "Untracked" headline (26px bold) spilled past the right edge of the Unpaid card | `text-xl` below 400px, `26px` from 400px up; re-measured: no overflow at 320 and 360 |

A second attempt (letting the card's lines flow inline on mobile) produced "Confirmed balance No days pending approval", which
misleads, so it was reverted; lines stay on separate rows.

## Deliberate differences from Figma

- The mobile frame has no "Request Leave" button; the app shows one under the welcome text on mobile (the sidebar item is
  inside the drawer).
- The footer tagline "People first" is not built (no source for it).
- Muted text uses our `#5b6c86` (4.91:1 on the page tint), not Figma's lighter `#5f718b`.
- The top-bar title shows the nav label ("Team Approvals") while each page's own h1 keeps sentence case ("Team approvals").
- Only the Manager view is designed; employee (three cards) and HR variants are derived from the role table.

## Backlog

- [ ] **Casing mismatch:** top bar says "My Balance" and the page h1 says "My balance"; align the page titles and the
      "Request leave" button label with the nav labels (Figma uses title case).
- [ ] **Avatar initials contrast:** `#2162ff` on `#e8f0ff` is 4.31:1 (under 4.5 for 14px bold). Decorative (`aria-hidden`, the
      name is the label) and taken from Figma, but worth a darker blue.
- [ ] **No browser tests:** drawer, dropdown and collapse behaviour is checked by a throwaway CDP script, not committed. Add jsdom
      and testing-library (exact pins) or a Playwright check if UI logic grows.
- [ ] Collapse state is not remembered across reloads (a cookie read in the layout would avoid a flash).
- [ ] The Next dev indicator overlaps the sidebar's collapse control in `next dev` only; it does not appear in a production build.
- [ ] Employee and HR dashboard variants have no design; confirm with the user's Figma when they add them.
- [ ] A forced two-line break in the Pending approvals card leaves an orphan word at 320px ("waiting").
