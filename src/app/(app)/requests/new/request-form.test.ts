import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BalanceSummaryItem } from "@/lib/leave/balance";
import { RequestForm } from "./request-form";

const BALANCES: BalanceSummaryItem[] = [
  {
    leaveTypeId: "vac",
    leaveTypeName: "Vacation",
    tracksBalance: true,
    confirmed: 12,
    pending: 2,
    available: 10,
  },
  {
    leaveTypeId: "sick",
    leaveTypeName: "Sick",
    tracksBalance: true,
    confirmed: 8,
    pending: 2,
    available: 6,
  },
  {
    leaveTypeId: "unp",
    leaveTypeName: "Unpaid",
    tracksBalance: false,
    confirmed: null,
    pending: 0,
    available: null,
  },
];

const render = (reviewerName: string | null = "Hana Reyes") =>
  renderToStaticMarkup(createElement(RequestForm, { balances: BALANCES, reviewerName }));

describe("RequestForm: the Request leave workspace (initial state, Figma 01)", () => {
  it("shows the leave type cards with the first type selected and the details form", () => {
    const out = render();
    expect(out).toContain("Leave type");
    expect(out.match(/type="radio"/g)).toHaveLength(3);
    expect(out).toMatch(/value="vac"[^>]*checked=""|checked=""[^>]*value="vac"/);
    expect(out).toContain("Request details");
    expect(out).toContain('id="start_date"');
    expect(out).toContain('id="end_date"');
    expect(out).toContain("Must not be before the start date.");
    expect(out).toContain('id="reason"');
    expect(out).toContain("0 / 500");
    expect(out).toContain("Submit request");
  });

  it("starts with an empty summary, the reviewer, and the guidance card", () => {
    const out = render();
    expect(out).toContain("Choose your dates to see a summary.");
    expect(out).toContain("Reviewer");
    expect(out).toContain("Hana Reyes");
    expect(out).toContain("Before you submit");
    expect(out).not.toContain("Over your available balance");
    expect(out).not.toContain("Request submitted");
  });

  it("hides the reviewer row when the reviewer could not be read, and keeps the rest", () => {
    const out = render(null);
    expect(out).not.toContain("Reviewer");
    expect(out).toContain("Request summary");
    expect(out).toContain("Submit request");
  });

  it("stacks in the order cards, details, summary, guidance, so the mobile order matches Figma", () => {
    const out = render();
    const at = (text: string) => out.indexOf(text);
    expect(at("Leave type")).toBeGreaterThan(-1);
    expect(at("Leave type")).toBeLessThan(at("Request details"));
    expect(at("Request details")).toBeLessThan(at("Request summary"));
    expect(at("Request summary")).toBeLessThan(at("Before you submit"));
  });

  it("is one column below xl and 3fr / 2fr from xl (672 / 448 px at 1440)", () => {
    const out = render();
    expect(out).toContain("xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]");
    expect(out).toContain("min-w-0");
  });

  it("leaves room under the content for the sticky submit bar on mobile only", () => {
    const out = render();
    expect(out).toContain("pb-44");
    expect(out).toContain("sm:pb-0");
  });

  it("labels every control and links the reason counter", () => {
    const out = render();
    expect(out).toContain('<label for="start_date"');
    expect(out).toContain('<label for="end_date"');
    expect(out).toContain('<label for="reason"');
    expect(out).toContain('aria-describedby="reason-count"');
    expect(out).toContain("maxLength");
  });
});
