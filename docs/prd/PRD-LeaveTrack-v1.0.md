# Product Requirements Document — LeaveTrack v1.0

Traces to: `docs/brd/BRD-LeaveTrack-v1.0.md`

## User Roles
- **Employee** — submits requests, views own balance.
- **Manager** — approves/rejects requests for direct reports only.
- **HR Admin** — configures leave policies, runs audit reports.

## User Stories

**US-01 — Submit a Leave Request** *(BR-01)*
As an Employee, I want to submit a leave request with type, start date, end date, and reason, so that my manager can review it without email.
- AC1: Given valid dates and a selected leave type, when I submit, then a request is created with status `pending` and my manager is notified.
- AC2: Given an end date before the start date, when I submit, then the form rejects it with a validation error and no request is created.
- AC3: Given a date range that exceeds my remaining balance for that leave type, when I submit, then I see a warning but may still submit for HR override.

**US-02 — View My Leave Balance** *(BR-03, BR-06)*
As an Employee, I want to see my current balance per leave type, so that I know what I have available before requesting.
- AC1: Given I have an assigned leave policy, when I open my balance page, then I see current balance per leave type, updated as of the last completed monthly accrual.
- AC2: Given a pending request exists, when I view my balance, then the pending amount is shown separately from the confirmed balance (not yet deducted).

**US-03 — Approve or Reject a Request** *(BR-02)*
As a Manager, I want to approve or reject a pending leave request from one of my direct reports, so that the decision is recorded and the employee is notified.
- AC1: Given a pending request from my direct report, when I approve it, then its status becomes `approved`, the employee's balance is decremented, and an audit record is created.
- AC2: Given a pending request from my direct report, when I reject it with a reason, then its status becomes `rejected`, no balance change occurs, and an audit record is created.
- AC3: Given a request from an employee who is NOT my direct report, when I attempt to view or act on it, then the system returns a 403 and the request never appears in my queue.

**US-04 — Manager Sees Only Their Team** *(BR-02)*
As a Manager, I want my request queue to show only my direct reports, so that I never see or act on another team's requests.
- AC1: Given I manage 5 employees, when I open my approvals queue, then I see requests from exactly those 5 and no one else.
- AC2: Given an org-chart change moves an employee to a different manager, when the change takes effect, then the employee's pending requests move to the new manager's queue.

**US-05 — HR Audit Report** *(BR-04)*
As an HR Admin, I want to query the full decision history for any employee or date range, so that I can produce compliance records on request.
- AC1: Given any employee ID, when I run the audit report, then I see every request they've made with status, decision-maker, and timestamp, going back at least 3 years.
- AC2: Given a completed request, when I view its record, then I can see it was never hard-deleted — only soft-deleted records are excluded from active views, never purged.

**US-06 — Mobile-Responsive Submission** *(BR-05)*
As an Employee on a mobile browser, I want to submit and check requests as easily as on desktop, so that I'm not blocked by not having a laptop.
- AC1: Given a viewport of 375px width, when I open the submit-request form, then all fields are usable without horizontal scrolling.
- AC2: Given a mobile browser, when I check my balance, then the page loads and renders correctly without a desktop-only layout.

**US-07 — Monthly Balance Accrual** *(BR-06)*
As the System, I want to accrue leave balances automatically on a monthly schedule, so that HR never has to update balances by hand.
- AC1: Given an employee's assigned policy grants 1.25 days/month for Vacation, when the monthly accrual job runs, then their Vacation balance increases by exactly 1.25 days.
- AC2: Given the accrual job has already run for the current month, when it is triggered again, then it does not double-accrue (idempotent).

**US-08 — Independently Tracked Leave Types** *(BR-07)*
As an Employee, I want Vacation, Sick, and Unpaid tracked separately, so that using one doesn't affect the others.
- AC1: Given I request Sick leave, when it's approved, then only my Sick balance is decremented — Vacation and Unpaid are unaffected.
- AC2: Given Unpaid leave has no balance policy, when I request it, then no balance check blocks the submission.

**US-09 — Sign In With My Own Account** *(BR-02, BR-04)*
As an Employee, Manager or HR Admin, I want to sign in with my own email and password, so that what I see and what I can do depend on who I really am.
- AC1: Given an email and password for an account HR has added, when I sign in, then I get a session as that person, with my own role and name.
- AC2: Given a wrong password or an unknown email, when I try to sign in, then I see one generic error and no session is created.
- AC3: Given a valid account whose email has no user record, when I sign in, then no session is created and I am told my account is not set up.
- AC4: Given I am signed in as a manager, when I open my approvals queue, then it is scoped by my own user id, and a request from another team never appears.
- AC5: Given I sign out, when I open a protected page, then I am sent to the sign-in page.
- AC6: Given the mock login is switched off, when anyone sends the old mock role cookie, then it grants no access.

Sign-up is disabled: only emails HR has added can sign in. Forced password change at first sign-in, emailed invites and an HR screen for creating users are out of scope for this story (see ADR-LeaveTrack-E003).

## Non-Functional Requirements
- p95 API response time under 500ms for balance and request-list endpoints.
- All approval-affecting endpoints require an authenticated session; scoped-visibility (US-03 AC3, US-04) is enforced server-side, never client-side only.

## Out of Scope
- Everything in the BRD's Out of Scope section: payroll integration, multi-country holiday calendars, biometric attendance.
