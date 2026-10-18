# Retro — My Balance redesign to the ChatGPT mockup (US-02 UI), 2026-10-18

Scope: the My Balance page restyled to follow a design mockup (made by ChatGPT from a prompt; stored in the session only, no Figma exists),
adapted to the app's current look. **Presentation only:** no SQL, `getBalancePage`, `summarizeBreakdown` or number changed; My Balance
still uses **3** statements (budget 4). Shared components (`Badge`, `Card`, `Alert`, `Button`, `leaveTypeLook`) were **not** modified.
No migration, PRD and `proxy.ts` untouched.

## Decisions (user, 2026-10-18)

- Mobile collapsible cards: **skipped** (all cards expanded, no new client code).
- Notes: **banner only**: one info banner under the cards; no per-card notes.
- Empty state: the mockup's, with the added sentence "Contact your manager or HR for assistance." (new wording the user accepted).
- My requests: a **table on desktop, stacked rows on phone**; ISO dates kept.
- Defaults the user did not change: real names Vacation, Sick, Unpaid; no "View all →" (no page to link to); sidebar and nav untouched; every
  number comes from the data, never from the picture (the mockup's own numbers were inconsistent).
- Added on the user's question "why can Used show −0": zero lines are **muted** (the sign stays in the gutter, the line stays).
- The new banner sentence, shown only when a card shows Adjustments: "Adjustments appears instead of the opening balance when it would be
  negative." (approved by going ahead).

## What changed

- `balance-card.tsx` (rewritten): icon tile on the type's tint, name as an `h2`, a Tracked / Not tracked chip (`Badge` neutral: green
  would collide with the Approved chips on the same page); the hero number first, then "Available after pending"; a sign gutter (the visible
  sign is `aria-hidden`, the word "plus", "minus" or "equals" is read with the value); muted zero lines; the Confirmed line never muted;
  Unpaid shows a dash, the untracked sentence and two rows with no group heading (Used days are not "set aside").
- `balance-states.tsx` (new): `BalanceNote` (the banner, `Alert` info with the `info` icon), `BalanceError` (centred card, `role="alert"` only
  around the message, the link outside it), `BalanceEmpty`, and `isBalanceEmpty`.
- `balance-requests.tsx` (new): a real `<table aria-label>` with `th scope="col"` headers and the leave type as the row header from `sm` up;
  a stacked `<ul>` below it. Two native structures instead of one table switched to `display: block` (which can drop table semantics).
- `balance-section.tsx`, `balance-skeleton.tsx`, `page.tsx` (plus icon on "Request leave"), `skeleton.test.ts` updated.
- **The empty state rule** (decided in the plan): empty only when every tracked type has confirmed 0, accrued 0, used 0 and pending 0. The
  old rule (no tracked type above 0) would have hidden the cards of someone who spent all their days.

## Acceptance criteria

| #   | Criterion                                                                                                                | Result | Evidence                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------- |
| R1  | Icon tile on its tint and a Tracked / Not tracked chip per type                                                          | PASS   | render tests; browser chips `["Tracked","Tracked","Not tracked"]` at every width and role                      |
| R2  | The hero number comes before its label                                                                                   | PASS   | render test; browser text order                                                                                |
| R3  | Signs hidden from assistive technology, words read with the values, groups keep `role="group"`; zero lines muted         | PASS   | render tests (markup, muted and unmuted cases); browser text "plus", "minus", "equals"                         |
| R4  | The equation banner appears once; no card has a note                                                                     | PASS   | section and card tests; browser `banner=1`                                                                     |
| R5  | The banner adds the Adjustments sentence only when a card shows Adjustments                                              | PASS   | section test both ways; browser: Marco `adjSentence=1`, Elena and Hana `0`                                     |
| R6  | Empty state (safe rule) with icon and both sentences; someone with used days is not empty                                | PASS   | unit and section tests; browser as Hana on an empty database at 1440, 375 and 320 px                           |
| R7  | Error state: `role="alert"`, both lines, a Try again link to `/balance`; a failed accrual caption never blocks the cards | PASS   | tests; browser with the database stopped: one alert, link reachable by keyboard                                |
| R8  | Requests: table with accessible name, headers and row headers from `sm`; stacked list below; rejected reason inline      | PASS   | tests; browser: table visible at 1440 (5 rows), list at 375 and 320 (5 rows), the reason shown once            |
| R9  | Unpaid: dash, no group heading, only Pending and Used                                                                    | PASS   | render tests; screenshots                                                                                      |
| R10 | A negative derived value shows "Adjustments" and reconciles                                                              | PASS   | tests; browser as Marco: Adjustments −5 days + 15 − 0 = 10                                                     |
| R11 | The skeleton mirrors the layout                                                                                          | PASS   | `skeleton.test.ts`: 3 cards with an icon circle, the note bar and a requests card                              |
| R12 | No hard-coded colours or inline styles in the new files                                                                  | PASS   | guard in each component test; proved by planting `bg-[#ff0000]` (it failed), then restoring the file identical |
| B12 | No horizontal scroll at 375, 320 and 1440 px                                                                             | PASS   | headless Chrome, three roles and the empty and error states at three widths: no horizontal scroll in any       |

The previous retro's B2 to B6, B9 to B11 and B13 are unchanged because the data code was not touched (their tests are in the green suite).

## Verification (mine)

- **Gate** (re-run by me): `lint`, `format:check`, `typecheck` clean; **555 tests passed, 37 skipped** (59 files passed, 6 skipped; the skipped
  are the gated real-database tests, unchanged since the last task). `npm run build` passed in a throwaway copy (the user's own `next start`
  stayed on port 3000 and was not touched).
- **Browser** on a production build in a throwaway copy, a seeded in-memory Postgres (pool of 1 in the copy only): Elena (normal; approved,
  pending and a rejected request with a note), Marco (Adjustments), Hana (no ledger), Hana on an **empty** variant, and the **error** state
  with the database stopped. Screenshots reviewed at 1440 and 375 px against the mockup: icon tiles, chips, hero first, sign gutter, muted
  zeros, one banner, table or stacked rows, centred error and empty cards all match. Heading order: H1 My balance, H2 per card (H3 for the
  two groups), H2 My requests.
- **Contrast**, computed from the token values for every text and background pair the new components use: all pass 4.5:1 (lowest 4.91:1 for
  the muted text on the page background; muted text on white 5.34:1; white on the button blue 4.93:1).
- **Keyboard**: "Request leave" is reached at Tab #8 and "Try again" at Tab #9, each with a solid 3 px focus outline (the sidebar takes the
  first seven stops).
- The page-load probe and the staging equivalence were **not re-run**: no SQL, helper or statement count changed, and the budget test stays
  green.

## Follow-up fix (user feedback after validation): the page did not use its full width

- **Symptom:** My Balance stopped short of the right edge while the dashboard and Request Leave filled the area.
- **Cause:** `balance/page.tsx` wrapped the page in `max-w-5xl` (1024 px). The app shell already caps the page area at 1352 px, and the
  dashboard and Request Leave carry no cap of their own. (Approvals and Audit History still have the old `max-w-5xl`; not changed, not asked.)
- **Fix:** removed that one class from the page container (`<div className="max-w-5xl">` is now `<div>`).
- **Measured** in a real browser (production build in a throwaway copy), content width of each page against the usable width: at 375, 1024, 1440
  and 1920 px the Dashboard, Request Leave and My Balance all fill **100%**, with identical right edges (for example 1408 px at 1440 and
  1720 px at 1920, where the shell's cap applies). Before the fix My Balance used 1024 of 1144 px at 1440. No horizontal scroll at any width.
  The gate stays green (555 passed, 37 skipped).

## Found during validation (pre-existing, not from this task)

- **One running app creates two database pools.** I added a log where a pool is created, in the throwaway copy only, and hit the routes:
  `/api/health` creates its own pool (count 1); the pages (balance, dashboard, request form, approvals) and `GET /api/leave-requests`
  share a second one (count 2, unchanged after five more routes). So per instance the connections can be up to 2 x `POOL_MAX` once the health
  route is hit (it only ever runs `select 1`). Earlier connection-count estimates (5, or 7 with a session pool) assumed one pool. Not
  changed here; see the backlog.
- This also explains the first-load error seen in the previous validation: the test database allows one connection, my startup loop polled
  `/api/health`, and the page's pool could not connect until the health pool's connection idled out (10 s). I first suspected idle
  reconnecting; that was wrong (four loads including one after a 13 s pause all worked). Starting the app without touching the health route
  gave a successful first load and zero `ECONNRESET`. Real Postgres allows many connections, so staging is unaffected.

## Not verified

- Anything on Vercel or with a real Supabase sign-in (the browser check used the mock login and an in-memory database).
- Screen readers: the markup (`dt`/`dd`, `sr-only` words, labelled groups, table headers) is tested, not heard.
- The skeleton's height against the loaded page was not compared pixel for pixel.

## Backlog

- **`/api/health` has its own pool** (two pools per process). Options: reuse the shared pool, or give health a `max: 1` client. A decision for the
  user; it changes connection counts, so check Supabase's limits first.
- **Empty-state edge case:** someone at 0 who spent days only in an earlier year and has nothing this year looks empty. Telling a missing balance
  row from a 0 row needs the data layer to say whether a row exists (a small additive flag).
- The `info` and `clipboard-list` icons are muted blue-grey (their SVG stroke), quieter than the mockup's bright blue. Reusing the existing
  icons was the choice; a blue variant would be a new asset.
- The hero shows "7 days" as one text node (the mockup makes "days" smaller). One node keeps the text and tests simple.
- Skipped by decision: collapsible mobile cards, "View all", the mockup's nav order. ISO dates remain (a separate backlog item).
- `/favicon.ico` 404 (already in the backlog). HR override for over-balance requests is still not built.
