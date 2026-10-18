# Retro — My Balance breakdown (US-02 UI), 2026-10-18

Scope: the My Balance page shows how each tracked leave type's days are made up, instead of only what is available.
Read side only: no migration, no write path touched, `proxy.ts` untouched. The PRD and CSV were **not** edited on purpose (user: skip
the PRD), so the criteria below are the checklist written in the plan from the user's request and decisions.

## Decisions (user, 2026-10-18)

- **Used this year** = all approved, non-deleted days whose dates fall in the current calendar year, including approved leave not yet
  taken (days are deducted at approval). Clipped to the year, weekdays only.
- A **derived opening balance** line makes the figures add up: opening = confirmed + used − accrued, so opening + accrued − used =
  confirmed. Nothing is stored and there is no migration.
- **My Balance page only**: the Request Leave cards and the dashboard cards are unchanged.
- Defaults the user did not change: the calendar year in `APP_TIMEZONE` (UTC when unset); Unpaid shows only Pending and Used; a
  negative derived value is labelled **Adjustments**; a note under Used says it "includes approved leave you have not taken yet";
  fractions are shown as stored.

## What changed

- New `src/lib/leave/breakdown.ts` (pure): `yearBounds`, `summarizeBreakdown` (wraps `summarizeBalances`, never changes it),
  arithmetic in whole hundredths so cents never drift.
- `src/lib/leave/service.ts`: `loadBreakdownRow`, one statement with five JSON subselects (types, balances, pending, used ranges
  clipped to the year with `greatest`/`least`, ledger totals summed in SQL), and `getBalancePage` (request list + that statement).
  `getMySummary` still serves `GET /api/leave-requests` with the same payload; its request-list query moved into a private helper both
  share. `loadSummaryRow` (dashboard, Request Leave, the submit transaction) was **not** touched.
- New `src/app/(app)/balance/balance-card.tsx` (presentational); `balance-section.tsx`, `page.tsx` (passes today in the app time
  zone) and `balance-skeleton.tsx` updated.
- Working days are counted by the existing `countWorkingDays` on ranges the SQL already clipped: one definition of a working day.
- Pool budget: My Balance uses **3** statements (request list, breakdown, last accrual); the limit is 4.

## Acceptance criteria

| #   | Criterion                                                                                           | Result | Evidence                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| B1  | A tracked card shows Available, Pending, Used this year, Accrued this year and Opening balance      | PASS   | render and section tests; browser text as Elena, Marco and Hana                                                            |
| B2  | Opening + Accrued − Used = Confirmed for every input, including cents                               | PASS   | unit cases; real engine for 3 users x 3 years; staging 63 rows                                                             |
| B3  | Used counts only approved, non-deleted days; pending, rejected and soft-deleted never count         | PASS   | real engine; with the status and deleted filters removed 4 of 8 tests fail                                                 |
| B4  | Weekends excluded and ranges clipped to the year (Dec 29 to Jan 5 is 3 days in each year)           | PASS   | real engine 2026 and 2027; unit; browser: Elena's Dec 29 to 31 request counts 3                                            |
| B5  | A request entirely outside the year is not counted                                                  | PASS   | real engine (2025 and 2028)                                                                                                |
| B6  | Accrued sums only the year's ledger months; none means 0 and opening = confirmed + used             | PASS   | real engine; staging oracle (ledger summed by the period's year); Sick with no ledger rows                                 |
| B7  | Unpaid shows only Pending and Used                                                                  | PASS   | render tests; browser (Unpaid: Used 2 days, no accrued, opening, confirmed or available)                                   |
| B8  | A negative derived value shows as "Adjustments" and still reconciles                                | PASS   | unit and render; browser as Marco: Adjustments −5 + Accrued 15 − Used 0 = Confirmed 10                                     |
| B9  | Another user's rows never counted; `user_id` filtered in SQL (Leo, another team)                    | PASS   | statement-text test; real engine; with the user scope removed on used and accrued 4 of 8 tests fail; file restored, diffed |
| B10 | Dashboard, Request Leave, submit and the API payload unchanged                                      | PASS   | shared statements untouched; equivalence tests for the figures they share; API shape test; probes as before                |
| B11 | My Balance stays within the budget                                                                  | PASS   | `query-budget.test.ts` (at most 3 with the real sections); live probe                                                      |
| B12 | No horizontal scroll at 375, 320 and 1440 px                                                        | PASS   | headless Chrome, 3 roles x 3 widths on a production build; screenshots reviewed                                            |
| B13 | The year follows `APP_TIMEZONE`                                                                     | PASS   | unit: 2026-12-31 20:00 UTC is 2027 in Manila and 2026 in UTC                                                               |
| B14 | A failed read keeps today's message and retry link; a failed accrual caption never blocks the cards | PASS   | section tests; the browser also showed the alert and the "Try again" link once (see Not verified)                          |

## Verification (mine)

- **Gate** on the final code (re-run after the ARIA fix): `lint`, `format:check`, `typecheck` clean; **518 tests passed, 37 skipped** (57
  files passed, 6 skipped; the skipped are the gated real-database tests, run separately below); `npm run build` passed in a throwaway
  copy (the user's own `next start` was on port 3000 throughout and was not touched).
- **Real engine (pglite), a fresh database per file:** breakdown 8/8, summary 5/5, leave-types 2/2 (submit and approve go through the
  shared statement), dashboard-lists 10/10, calendar 8/8.
- **Browser** on a production build in a throwaway copy, a seeded pglite database with fixtures (Elena: approved Mar 2 to 4 and Dec 29 to 31,
  ledger Jan and Feb, an Unpaid request; Marco: ledger above his balance; Hana: nothing). Elena Vacation: Available 7, Opening 13.5 +
  Accrued 2.5 − Used 6 = Confirmed 10, Pending 3. No horizontal scroll at 375, 320 and 1440 px for all three roles. The only console
  error was `/favicon.ico` 404 (already in the backlog).
- **Staging, read-only:** the new Used and Accrued equal an independent hand computation (a separate `generate_series` weekday count and a
  plain ledger sum) for 63 of 63 rows (7 users, 3 types, 2025 to 2027). It also reproduces the seed's opening balances exactly
  (Vacation 10, Sick 5 for everyone; Elena's Sick: 5 + 1 − 3 = 3, matching her approved 3-day request).
- **Page-load probe on staging** with the real pool, `timedRead` and the final code: manager dashboard x4 and employee x4 clean (about
  200 ms, 860 ms first); mixed navigation (Dashboard, Request Leave, My Balance, Approvals) x6: 0 problems of 24 (My Balance 190 to 197 ms);
  one held connection 672 ms; two held 3.2 s through the retry, as before.

## Found and fixed during validation

- `aria-labelledby` was on the bare `<dl>`, which has no role to name. Each list is now inside a `role="group"` that the heading labels.

## Not verified

- Nothing on Vercel or with a real Supabase sign-in (the shared password is the user's). The browser check used the mock login.
- Screen readers: the markup (`dt`/`dd`, `sr-only` words for the signs, grouped headings) is tested, not heard.
- The skeleton's height against the loaded card was not compared pixel for pixel.
- The first page load in the browser run showed the "could not be loaded" state (`ECONNRESET` about 30 ms in). **Corrected in the
  redesign validation (`2026-10-18-my-balance-redesign.md`):** the cause was not the retry. One running app creates **two** database
  pools (the `/api/health` route has its own), my startup loop polled the health route, and the one-connection test database could
  not serve the page's pool until the health pool's connection idled out. Starting the app without touching the health route made the
  first load succeed. The page showed its designed error state with the retry link, which is itself a check of that state.

## Backlog

- The two-sentence caption ("Opening balance + accrued − used = confirmed balance. Includes approved leave you have not taken yet.")
  repeats on every card. Once per page would be quieter.
- Types with no activity still show "+ 0 days" and "− 0 days".
- Staging has almost no approved requests, so Used is 0 for everyone except Elena's Sick until someone approves a request. The seed
  cannot deduct a balance idempotently, so it only holds pending requests. Approving one live changes staging balances for good.
- A request that crosses New Year was deducted in full at approval, but Used counts only this year's days, so the difference lands in
  Adjustments. A stored opening balance would remove this.
- `/favicon.ico` 404 (already in the backlog). HR override for over-balance requests is still not built.
- If the user sends a My Balance Figma, realign the card; no design exists yet.
