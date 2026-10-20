import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FilterShell } from "@/components/ui/filter-shell";
import {
  DEFAULT_TEAM_QUERY,
  parseTeamQueueQuery,
  type TeamQueueQuery,
} from "@/lib/leave/team-queue-schema";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
const { ApprovalsFilters } = await import("./approvals-filters");

const TYPE = "10000000-0000-4000-8000-000000000001";
const leaveTypes = [
  { id: "10000000-0000-4000-8000-000000000002", name: "Sick" },
  { id: TYPE, name: "Vacation" },
];
const render = (query: Partial<TeamQueueQuery> = {}, view: "pending" | "decided" = "pending") =>
  renderToStaticMarkup(
    createElement(
      FilterShell,
      null,
      createElement(ApprovalsFilters, {
        query: {
          ...(view === "pending" ? DEFAULT_TEAM_QUERY : parseTeamQueueQuery({ view }).query),
          ...query,
        },
        leaveTypes,
      }),
    ),
  );

describe("ApprovalsFilters (EPIC-14 AC1)", () => {
  it("has a labelled control for every filter, in a search form that is also a plain GET form", () => {
    const html = render();
    for (const [id, label] of [
      ["approvals-q", "Search by employee name"],
      ["approvals-type", "Leave type"],
      ["approvals-status", "Status"],
      ["approvals-order", "Sort by"],
      ["approvals-from", "Leave from"],
      ["approvals-to", "Leave to"],
      ["approvals-per", "Rows per page"],
    ])
      expect(html).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>${label}</label>`));
    expect(html).toMatch(/<form[^>]*method="get"/);
    expect(html).toMatch(/<form[^>]*action="\/approvals"/);
    expect(html).toContain('role="search"');
    expect(html).toMatch(/<input[^>]*id="approvals-from"[^>]*type="date"/);
    expect(html).toMatch(/<input[^>]*id="approvals-to"[^>]*type="date"/);
  });

  it("the pending view offers its three statuses and its sorts", () => {
    const html = render();
    for (const t of [
      "All statuses",
      "Can approve",
      "Waiting for HR override",
      "Needs a balance fix",
      "Oldest request first",
      "Most working days",
      "Leave starts soonest",
    ])
      expect(html, t).toContain(t);
    expect(html).not.toContain("Latest decision first");
    expect(html).not.toContain("Rejected</option>");
  });

  it("the decided view offers its own statuses and sorts", () => {
    const html = render({}, "decided");
    for (const t of [
      "Approved</option>",
      "Rejected</option>",
      "Approved (HR override)",
      "Latest decision first",
    ])
      expect(html, t).toContain(t);
    expect(html).not.toContain("Waiting for HR override");
    expect(html).not.toContain("Most working days");
  });

  it("lists the leave types and the page sizes, with the applied values selected and chips for each filter", () => {
    const html = render({
      type: TYPE,
      status: "over",
      from: "2026-11-02",
      to: "2026-11-30",
      q: "ana",
      per: 50,
      sort: "days",
      dir: "desc",
    });
    expect(html).toContain("Sick");
    expect(html).toMatch(new RegExp(`<option value="${TYPE}" selected`));
    expect(html).toMatch(/<option value="over" selected/);
    expect(html).toMatch(/<option value="days:desc" selected/);
    expect(html).toMatch(/<option value="50" selected/);
    expect(html).toContain('value="2026-11-02"');
    expect(html).toContain('value="ana"');
    for (const chip of [
      "Name: ana",
      "Leave type: Vacation",
      "Status: Waiting for HR override",
      "From Nov 2, 2026",
      "To Nov 30, 2026",
    ])
      expect(html).toContain(`aria-label="Remove filter ${chip}"`);
    expect(html).toContain("Clear all");
  });

  it("opens the selects on a phone only when a filter is applied", () => {
    expect(render()).toMatch(/aria-expanded="false"[^>]*aria-controls="approvals-selects"/);
    expect(render({ status: "ok" })).toMatch(/aria-expanded="true"/);
    expect(render({ from: "2026-11-02" })).toMatch(/aria-expanded="true"/);
  });
});
