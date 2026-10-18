# Retro — Request Leave redesign (US-01 UI), 2026-10-18

Scope: `/requests/new` rebuilt from Figma `GrKk5YyfJcDRdPBr7xXTF9` (desktop 26:17257 and state frames, mobile 26:20368).
The write path is unchanged: same `POST /api/leave-requests` call and body. No migration, `proxy.ts` untouched.
The PRD was **not** edited on purpose (user: "don't edit the PRD"), so there is no US-12 and no TASK-033. The criteria below are
US-01 AC1–AC3 plus the redesign checklist from the plan.

## Decisions (user)

- Info line keeps the HR-override wording (PRD US-01 AC3). The override is **not built**: do not approve an over-balance request live.
- A user with no manager shows reviewer "HR" (unit-tested; every seed user has a manager, so the browser shows names).
- Build the full version: type cards, live summary, "Before you submit", state frames, mobile sticky submit bar.

## Acceptance criteria

| Criterion                                                           | Result | Evidence                                                                                                   |
| ------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| US-01 AC1 submit creates a Pending request                          | PASS   | Browser submit, then the dashboard lists Nov 2–4 Pending; success card shows Pending                       |
| US-01 AC2 end before start is rejected                              | PASS   | Field error + disabled submit in the browser; API returns `VALIDATION_ERROR` for the same range            |
| US-01 AC3 over balance warns, can still submit                      | PASS   | Summary shows "−37 days", warning note, submit enabled; API returns 200 with an `OVER_BALANCE` warning     |
| Type cards: radio group, keyboard selectable                        | PASS   | ArrowRight and ArrowLeft move the selection (CDP key events)                                               |
| Live summary: empty, ready, invalid, over, untracked                | PASS   | Browser text for empty, ready, invalid and over; untracked covered by unit tests                           |
| Reviewer row: manager name, "HR" fallback, hidden if the read fails | PASS   | Names per role in the browser (Marco Santos, Hana Reyes, Sam Okafor); fallback and null covered by tests   |
| Mobile sticky submit bar, content not hidden behind it              | PASS   | 375px: bar fixed at the bottom, last card ends 115px above it; static inside the card from `sm`            |
| No horizontal scroll at 375 / 320 / 1440                            | PASS   | `scrollWidth == clientWidth` at all three, in every state checked                                          |
| Success state: focus moves to the heading, "Submit another" resets  | PASS   | `document.activeElement.id == request-submitted-heading`; reset returns the empty form                     |
| Gate: lint, format:check, typecheck, test, build                    | PASS   | 479 tests passed / 24 skipped; production build ok in a throwaway copy (pglite, pool `max: 1` in the copy) |

Blast radius (graphify): only links to `/requests/new` (nav, dashboard, balance) and `skeleton.test.ts` (already updated) reference it.

## Deviations from Figma (flag to the user)

- Icons `info`, `circle-alert`, `lock` are **hand-drawn** in the Figma stroke style; the Figma MCP limit was hit before they could be exported.
  The Figma "info" layer was really the clipboard (a bell on Over balance).
- Input borders stay `border-ink-muted` (about 3:1 on white); Figma's light border is about 1.2:1.
- The calendar icon is an image, so it stays grey in the field-error state.
- The over-balance server warning is kept on the success card (not in the Figma frame).

## Backlog

- Success card keeps the summary card showing the submitted dates and the "Balance after" figure from before the submit (it does not
  re-read the balance). Matches the Figma Success frame; revisit when the balance is refetched after submit.
- Firefox shows its own date-picker icon next to the overlaid Figma one.
- `/favicon.ico` 404 (already in the backlog).
- Over-balance requests cannot be approved with an override yet (US-01 AC3 wording promises it).
- Integration tests still need a fresh DB; CI wiring is open.

## Notes

- `<fieldset disabled>` disables its radios but leaves each `input.disabled` property `false`; check `:disabled` or the fieldset, not the property.
- A date input set from a script needs the native value setter plus a bubbling `input` event, or React ignores it.
