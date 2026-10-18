import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ApprovalsLoading from "@/app/(app)/approvals/loading";
import AuditLoading from "@/app/(app)/audit/loading";
import BalanceLoading from "@/app/(app)/balance/loading";
import DashboardLoading from "@/app/(app)/dashboard/loading";
import FallbackLoading from "@/app/(app)/loading";
import TeamLoading from "@/app/(app)/approvals/team/loading";
import TeamMemberLoading from "@/app/(app)/approvals/team/[userId]/loading";
import NewRequestLoading from "@/app/(app)/requests/new/loading";
import { Skeleton } from "@/components/ui/skeleton";

const render = (component: ComponentType) => renderToStaticMarkup(createElement(component));
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("Skeleton", () => {
  it("is decorative, uses a token colour and only pulses when motion is allowed", () => {
    const html = renderToStaticMarkup(createElement(Skeleton, { className: "h-4 w-10" }));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("bg-grey-200");
    expect(html).toContain("motion-safe:animate-pulse");
    expect(html).toContain("h-4 w-10");
  });
});

describe.each([
  ["fallback", FallbackLoading],
  ["dashboard", DashboardLoading],
  ["balance", BalanceLoading],
  ["team roster", TeamLoading],
  ["approvals", ApprovalsLoading],
  ["audit", AuditLoading],
  ["request form", NewRequestLoading],
] as const)("%s loading state", (_name, component) => {
  const html = render(component);

  it("announces itself once to screen readers as a busy status", () => {
    expect(count(html, 'role="status"')).toBe(1);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('<span class="sr-only">Loading…</span>');
  });

  it("is purely visual: no headings, links or controls to tab into", () => {
    expect(html).not.toMatch(/<(h[1-6]|a|button|input|select|textarea)[\s>]/);
  });

  it("uses design tokens only (no hard-coded colours)", () => {
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(/);
  });

  it("has a header placeholder like the real page", () => {
    // Every page has a page-header block; the dashboard's is its welcome heading.
    expect(html).toMatch(/h-8 w-48|h-9 w-64/);
  });
});

describe("loading states mirror their pages", () => {
  it("balance: header action, three balance cards (icon and chip), the note bar and a requests card", () => {
    const html = render(BalanceLoading);
    expect(html).toContain("h-11 w-32"); // the Request leave action
    expect(count(html, "lg:grid-cols-3")).toBe(1);
    expect(count(html, "shadow-tile")).toBe(4); // three balance cards and the requests card
    expect(count(html, "size-9")).toBe(3); // an icon circle per balance card
    expect(count(html, "rounded-full")).toBe(9); // circle and chip per card, a badge per request row
    expect(html).toContain("h-12 w-full"); // the note under the cards
  });

  it("approvals: the tabs, pending rows with Approve and Reject placeholders, then decided rows", () => {
    const html = render(ApprovalsLoading);
    expect(count(html, "border-b border-line")).toBe(1); // the tab bar
    expect(count(html, "shadow-tile")).toBe(4); // two pending rows, two decided rows
    expect(count(html, "sm:w-28")).toBe(4); // two buttons on each of the two pending rows
  });

  it("audit: the filter card, five summary figures and the rows", () => {
    const html = render(AuditLoading);
    expect(count(html, "h-11 w-full")).toBe(7); // search, five controls and the button
    expect(count(html, "shadow-tile")).toBe(7); // the filter card, five figures, the rows card
    expect(count(html, "lg:grid-cols-5")).toBe(1);
    expect(html).not.toContain("max-w-5xl");
  });

  it("request form: three leave type cards, the details card, and the summary and guidance cards", () => {
    const html = render(NewRequestLoading);
    expect(count(html, "h-[156px]")).toBe(3); // one placeholder per leave type card
    expect(count(html, "h-[70px]")).toBe(2); // the two date fields
    expect(count(html, "h-[128px]")).toBe(1); // the reason box
    expect(count(html, "h-11 w-full")).toBe(1); // the submit button
    expect(count(html, "h-[210px]")).toBe(1); // the summary card
    expect(count(html, "h-[260px]")).toBe(1); // the guidance card
    expect(html).toContain("xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"); // same grid as the page
    expect(html).not.toContain("max-w-xl"); // the narrow form column is gone
  });

  it("dashboard: a welcome block, four summary cards and a calendar of five week rows", () => {
    const html = render(DashboardLoading);
    expect(html).toContain("h-9 w-64"); // the welcome heading
    expect(html).toContain("h-11 w-36"); // the Request Leave action
    expect(count(html, "min-h-[148px]")).toBe(4);
    expect(count(html, "shadow-tile")).toBe(5); // four cards and the calendar card
    expect(count(html, "h-[86px]")).toBe(5); // one placeholder per week row
  });
});

describe("team loading states mirror their pages", () => {
  it("team roster: the header and a row per person with an avatar circle and a chip", () => {
    const html = render(TeamLoading);
    expect(count(html, "shadow-tile")).toBe(4); // four people
    expect(count(html, "size-10")).toBe(4); // an avatar circle each
    expect(count(html, "rounded-full")).toBe(8); // the circle and a pending chip each
  });

  it("team member: back link, the person, two balance cards, the filter card and the requests card", () => {
    const html = render(TeamMemberLoading);
    expect(count(html, 'role="status"')).toBe(1);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("size-12"); // the person's avatar
    expect(count(html, "sm:grid-cols-2")).toBe(1); // the two balance cards
    expect(count(html, "shadow-tile")).toBe(4); // two balances, the filters, the requests
  });

  it("team member: purely visual and tokens only", () => {
    const html = render(TeamMemberLoading);
    expect(html).not.toMatch(/<(h[1-6]|a|button|input|select|textarea)[\s>]/);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(/);
  });
});
