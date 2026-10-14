import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ApprovalsLoading from "@/app/(app)/approvals/loading";
import AuditLoading from "@/app/(app)/audit/loading";
import BalanceLoading from "@/app/(app)/balance/loading";
import DashboardLoading from "@/app/(app)/dashboard/loading";
import FallbackLoading from "@/app/(app)/loading";
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
    expect(html).toContain("h-8 w-48");
  });
});

describe("loading states mirror their pages", () => {
  it("balance: header action, three balance cards and a request list", () => {
    const html = render(BalanceLoading);
    expect(html).toContain("h-11 w-32"); // the Request leave action
    expect(count(html, "lg:grid-cols-3")).toBe(1);
    expect(count(html, "shadow-sm")).toBe(3);
    expect(count(html, "rounded-full")).toBe(3); // a status badge per request row
  });

  it("approvals: cards with an Approve and a Reject button placeholder", () => {
    const html = render(ApprovalsLoading);
    expect(count(html, "shadow-sm")).toBe(2);
    expect(count(html, "sm:w-28")).toBe(4); // two buttons on each of two cards
  });

  it("audit: the filter form (employee, two dates) with no results yet", () => {
    const html = render(AuditLoading);
    expect(count(html, "h-11 w-full")).toBe(4); // three 44px controls and the button
    expect(count(html, "sm:grid-cols-2")).toBe(1);
  });

  it("request form: a type, two dates, a tall reason box and a submit button", () => {
    const html = render(NewRequestLoading);
    expect(count(html, "h-11 w-full")).toBe(4); // three controls and the submit button
    expect(count(html, "h-24 w-full")).toBe(1);
    expect(html).toContain("max-w-xl");
  });

  it("dashboard: a grid of cards each with a button", () => {
    const html = render(DashboardLoading);
    expect(count(html, "shadow-sm")).toBe(4);
    expect(count(html, "h-11 w-24")).toBe(4);
  });
});
