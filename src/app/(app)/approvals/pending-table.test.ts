import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FilterShell } from "@/components/ui/filter-shell";
import type { DecidedTeamRequestView, TeamRequestView } from "@/lib/leave/team";
import {
  DEFAULT_TEAM_QUERY,
  parseTeamQueueQuery,
  type TeamQueueQuery,
} from "@/lib/leave/team-queue-schema";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
const { PendingList } = await import("./pending-table");
const { DecidedList } = await import("./decided-table");
const pendingSource = readFileSync(new URL("./pending-table.tsx", import.meta.url), "utf8");

const NOW = new Date("2026-10-19T09:00:00Z");
const base: TeamRequestView = {
  id: "r1",
  employee_name: "Elena Cruz",
  leave_type_id: "t1",
  leave_type_name: "Vacation",
  tracks_balance: true,
  start_date: "2026-11-02",
  end_date: "2026-11-04",
  reason: "Family trip",
  status: "pending",
  created_at: new Date("2026-10-14T00:00:00Z"),
  working_days: 3,
  balance: 10,
  balanceCheck: { kind: "ok" },
};
const over: TeamRequestView = {
  ...base,
  id: "r2",
  employee_name: "Daniel Kim",
  reason: "",
  balance: 2,
  balanceCheck: { kind: "over", balance: 2, shortfall: 1 },
};
const blocked: TeamRequestView = {
  ...base,
  id: "r3",
  employee_name: "Maria Lopez",
  balance: null,
  balanceCheck: { kind: "no_balance_record" },
};
const renderPending = (rows: TeamRequestView[], query: Partial<TeamQueueQuery> = {}) =>
  renderToStaticMarkup(
    createElement(
      FilterShell,
      null,
      createElement(PendingList, {
        rows,
        query: { ...DEFAULT_TEAM_QUERY, ...query },
        now: NOW,
        timeZone: "Asia/Manila",
      }),
    ),
  );

describe("PendingList (EPIC-14 AC1, AC5)", () => {
  const html = renderPending([base, over, blocked]);

  it("is a real table from xl and cards below: two structures, one hidden at each size", () => {
    expect(html).toMatch(/<div class="hidden[^"]*xl:block">\s*<table/);
    expect(html).toMatch(/<ul[^>]*class="[^"]*xl:hidden"/);
    expect(html.match(/aria-label="Pending requests"/g)).toHaveLength(2);
  });

  it("has column headers with scope, a sticky header and the employee as the row header", () => {
    for (const label of ["Employee", "Dates", "Submitted", "Status", "Actions"])
      expect(html).toMatch(new RegExp(`<th[^>]*scope="col"[^>]*>(<a[^>]*>)?(<span>)?${label}`));
    expect(html).toContain("sticky top-0");
    expect(html.match(/<th[^>]*scope="row"/g)).toHaveLength(3);
  });

  it("marks only the sorted column with aria-sort and gives each sortable header its link", () => {
    expect(html.match(/aria-sort="ascending"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-sort="ascending"[^>]*><a href="\/approvals\?dir=desc"/); // Submitted (created asc)
    expect(html).toContain('href="/approvals?sort=name"');
    expect(html).toContain('href="/approvals?sort=start"');
    const byName = renderPending([base], { sort: "name", dir: "desc" });
    expect(byName).toMatch(/aria-sort="descending"[^>]*><a href="\/approvals\?sort=name"/);
    expect(html).not.toMatch(/<th[^>]*><a[^>]*>Actions/);
  });

  it("shows the dates with the working days, and the reason beneath them", () => {
    expect(html).toContain("Nov 2 to Nov 4, 2026");
    expect(html).toContain("3 working days");
    expect(html).toContain("Reason: Family trip");
  });

  it("shows the balance state in words: Approve and Reject when ok, Reject only when over or blocked", () => {
    expect(html).toContain("Over balance by 1 day");
    expect(html).toContain("Waiting for HR override");
    expect(html).toContain("No balance record");
    // the decision buttons: Approve only for the request that can be approved (twice: table and card)
    expect(html.match(/>Approve</g)).toHaveLength(2);
    expect(html.match(/>Reject</g)).toHaveLength(6); // three requests, table and card
  });

  it("shows when it was submitted in the app's time zone", () => {
    expect(html).toContain("Oct 14 · 8:00 AM");
  });

  it("the decision buttons are the same client component in both structures, the flow is not reimplemented", () => {
    expect(pendingSource).toContain('import { ApprovalActions } from "./approval-actions"');
    expect(pendingSource).toContain(
      "<ApprovalActions requestId={r.id} canApprove showApprove={note === null} />",
    );
    expect(pendingSource).toContain("<ApprovalRow");
    expect(pendingSource).not.toMatch(/fetch\(/);
  });

  it("uses tokens only: no hex colour, rgb() or inline style", () => {
    expect(pendingSource).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(|style=/);
  });
});

describe("DecidedList (EPIC-14)", () => {
  const rejected: DecidedTeamRequestView = {
    id: "d1",
    employee_name: "Elena Cruz",
    leave_type_name: "Sick",
    start_date: "2026-10-01",
    end_date: "2026-10-01",
    status: "rejected",
    decision_note: "Team is short that week",
    decided_at: new Date("2026-10-02T00:00:00Z"),
    working_days: 1,
    overridden: false,
  };
  const overridden: DecidedTeamRequestView = {
    ...rejected,
    id: "d2",
    employee_name: "Daniel Kim",
    status: "approved",
    decision_note: null,
    overridden: true,
  };
  const out = renderToStaticMarkup(
    createElement(
      FilterShell,
      null,
      createElement(DecidedList, {
        rows: [rejected, overridden],
        query: parseTeamQueueQuery({ view: "decided" }).query,
        now: NOW,
        timeZone: "Asia/Manila",
      }),
    ),
  );

  it("is a table from xl and cards below, with scoped headers and a sorted Decided column", () => {
    expect(out).toMatch(/<div class="hidden[^"]*xl:block">\s*<table/);
    expect(out).toMatch(/<ul[^>]*class="[^"]*xl:hidden"/);
    for (const label of ["Employee", "Dates", "Outcome", "Decided"])
      expect(out).toMatch(new RegExp(`<th[^>]*scope="col"[^>]*>(<a[^>]*>)?(<span>)?${label}`));
    expect(out).toMatch(
      /aria-sort="descending"[^>]*><a href="\/approvals\?view=decided&amp;dir=asc"/,
    );
  });

  it("writes the outcome in words, with the rejection note and the HR override mark, and has no actions", () => {
    expect(out).toContain("Rejected");
    expect(out).toContain("Rejection note: Team is short that week");
    expect(out).toContain("Approved (HR override)");
    expect(out).not.toContain(">Approve<");
    expect(out).not.toContain(">Reject<");
    expect(out).not.toContain("Reason:");
  });

  it("says when each was decided, in the cards as well", () => {
    expect(out.match(/Oct 2 · 8:00 AM/g)!.length).toBeGreaterThanOrEqual(3);
    expect(out).toContain("Decided Oct 2 · 8:00 AM");
  });
});
