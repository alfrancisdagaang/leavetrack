# Business Requirements Document — LeaveTrack v1.0

## Executive Summary
LeaveTrack replaces an email-and-spreadsheet leave process with a self-service system: employees submit and track leave requests, managers approve for their own team only, and HR gets an auditable record ahead of the Q3 compliance audit.

## Business Context
Leave requests currently move by email and a shared spreadsheet. Managers report being blindsided by approvals they never saw; HR has no reliable record of who approved what, which Legal has flagged as a compliance gap. Employees have no way to check their own balance without asking HR directly.

## Stakeholders
| Stakeholder | Concern |
|---|---|
| Employees (~800 staff, ~30% without laptops) | Submit requests and see their balance without contacting HR |
| Managers | See and decide on requests only for their own direct reports |
| HR Administrators | An auditable, queryable record of every decision |
| Legal / Compliance | Retained approval records ahead of the Q3 audit |

## Scope

### In Scope
- BR-01 through BR-07 below.

### Out of Scope
- Payroll system integration.
- Multi-country public-holiday calendars.
- Biometric or badge-based attendance tracking.

## Functional Requirements

**BR-01 — Leave Request Submission.** Employees must be able to submit a leave request specifying leave type, start date, end date, and a reason, so that leave is tracked in one system instead of email and spreadsheets.

**BR-02 — Scoped Manager Approval.** Managers must be able to view and approve or reject leave requests only from their own direct reports — never the full staff list.

**BR-03 — Self-Service Balance Visibility.** Employees must be able to view their current leave balance, by leave type, at any time without contacting HR.

**BR-04 — Auditable Decision Record.** Every leave request decision (submitted, approved, rejected, by whom, and when) must be recorded and retained for a minimum of 3 years, to satisfy the compliance requirement Legal raised ahead of the Q3 audit.

**BR-05 — Mobile Accessibility.** The system must be fully usable on a mobile browser, since roughly 30% of the 800-person staff do not have a company laptop.

**BR-06 — Automatic Balance Accrual.** Leave balances must accrue automatically on a monthly cycle, based on each employee's assigned leave policy (e.g., 1.25 days/month for full-time staff), without manual HR intervention.

**BR-07 — Independently Tracked Leave Types.** The system must support at least three leave types — Vacation, Sick, and Unpaid — each with its own independently tracked balance where applicable (Unpaid has no balance to track).

## Non-Functional Requirements
- Must be in production before the Q3 compliance audit.
- Must support 800 concurrent staff without degradation.
- Decision records retained for 3+ years (BR-04) — no hard-delete on leave requests or approvals.

## Constraints
- Timeline: production-ready before Q3.
- Staff size: ~800, roughly 30% mobile-only.
- Compliance: 3-year minimum retention on approval records.

## Assumptions
- Each employee has exactly one manager for approval-routing purposes.
- Leave policies (accrual rate per leave type) are configured by HR, not self-service.

## Risks
- If accrual logic (BR-06) is wrong, every employee's balance is wrong — this requirement needs the tightest acceptance criteria and the most test coverage.
- Scoped approval (BR-02) is a security-relevant requirement: a manager seeing another team's requests is a data-exposure incident, not a cosmetic bug.

## Success Criteria
- 100% of leave requests move through LeaveTrack, zero through email/spreadsheet, within one month of launch.
- HR can produce a complete, dated approval record for any employee within one query, at any time.
- Zero cross-team visibility incidents in the first quarter post-launch.
