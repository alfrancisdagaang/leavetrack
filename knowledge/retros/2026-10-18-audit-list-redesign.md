# Retro: Audit History list redesign (US-05, new list slice)

Built from the ChatGPT mockup (image 7), on the plan's defaults. PRD story US-14 and the epic CSV are **not written yet** (the PRD edit needs the user's OK).

## What shipped

- `/audit` is an all-employees list: name search, leave type, status (incl. Removed), decided by, UTC date range; summary strip; a table from `sm` and stacked rows below; 25 per page. HR only, read-only, full width. Reads: `getAuditFilterChoices` + `getAuditPage` (2 statements, one each).
- A request is in exactly one bucket (deleted first), so Approved + Rejected + Pending + Removed = Total. The employee's `reason` and the decision note are never selected.
- The team member page's filter shell moved to `src/components/ui/filter-shell.tsx` (shared); `MemberPagination` takes a page size.

## Validation

- Gate in a throwaway copy: lint, format, typecheck, 745 tests, build. Real-engine test (12) passes; **13 break-the-filter mutations all caught** (name, type, decided-by, status/soft delete, bucket, three date bounds, wildcard escaping, offset clamp, order, reason leak, decider choices).
- Browser (prod build, pglite) as HR at 1440, 375, 320: width 100% like the dashboard at 320 to 1920 px, filters and chips apply with no reload (flags survive), pagination, past-the-end shows the last page, bad address names the ignored filters, no-JS GET form works, manager and employee redirected, 44px controls.

## Not done

- Request details page `/audit/[requestId]` with the timeline (plan step 12): the table has no chevron until it exists.
- PRD US-14, `epic-5-audit-tasks.csv`. `listEmployees` in `audit.ts` is now unused by the page (kept for its tests).
- Dropped from the mockup on purpose: "Viewed" and "Created" timeline events (not in the data; logging views would make a read write), export, time zone toggle, the mock's invented names.
- Audit of reads (who looked at whom) stays in the backlog.
- Name search is an unindexed `ilike` over `leave_requests` joined to users: fine at pilot size.
