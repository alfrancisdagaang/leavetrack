import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RequestSuccess } from "@/components/ui/request-success";
import type { LeaveWarning } from "@/lib/leave/balance";

const WARNING: LeaveWarning = {
  code: "OVER_BALANCE",
  message: "This request is 11 working days but only 10 Vacation days are available.",
  requestedDays: 11,
  availableDays: 10,
};

const render = (warnings: LeaveWarning[] = []) =>
  renderToStaticMarkup(
    createElement(RequestSuccess, {
      leaveTypeName: "Vacation",
      rangeText: "Nov 2–4 2026",
      daysText: "3 working days",
      warnings,
      onAnother: () => {},
    }),
  );

describe("RequestSuccess (Figma 10)", () => {
  it("confirms the request with its type, dates, days and a Pending status in text", () => {
    const out = render();
    expect(out).toContain("Request submitted");
    expect(out).toContain("Your manager can now review it");
    expect(out).toContain("Vacation");
    expect(out).toContain("Nov 2–4 2026");
    expect(out).toContain("3 working days");
    expect(out).toContain("Pending");
    expect(out).toContain("clock-3.svg");
    expect(out).toContain("check-success.svg");
  });

  it("offers View my balance (a link) and Submit another (a button)", () => {
    const out = render();
    expect(out).toMatch(/<a[^>]*href="\/balance"[^>]*>View my balance/);
    expect(out).toMatch(/<button[^>]*type="button"[^>]*>Submit another/);
  });

  it("can take focus, so the page can move it here after submitting", () => {
    const out = render();
    expect(out).toContain('id="request-submitted-heading"');
    expect(out).toContain('tabindex="-1"');
  });

  it("still shows the server's over-balance warning, which the Figma does not have", () => {
    const out = render([WARNING]);
    expect(out).toContain("Over your available balance.");
    expect(out).toContain("only 10 Vacation days are available");
    expect(render()).not.toContain("Over your available balance");
  });
});
