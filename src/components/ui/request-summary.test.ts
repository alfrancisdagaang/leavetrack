import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RequestSummaryCard } from "@/components/ui/request-summary";
import type { RequestPreview } from "@/lib/leave/request-preview";

const ready = (over: Partial<Extract<RequestPreview, { kind: "ready" }>> = {}): RequestPreview => ({
  kind: "ready",
  leaveTypeName: "Vacation",
  rangeText: "Mon 2 Nov – Wed 4 Nov 2026",
  shortRangeText: "Nov 2–4 2026",
  days: 3,
  daysText: "3 working days (Mon-Fri)",
  balanceAfter: 7,
  balanceAfterText: "7 days",
  over: false,
  ...over,
});

const render = (preview: RequestPreview, reviewerName: string | null = "Hana Reyes") =>
  renderToStaticMarkup(createElement(RequestSummaryCard, { preview, reviewerName }));

describe("RequestSummaryCard", () => {
  it("empty: asks for the dates", () => {
    const out = render({ kind: "empty" });
    expect(out).toContain("Request summary");
    expect(out).toContain("Choose your dates to see a summary.");
    expect(out).toContain("clipboard-list.svg");
  });

  it("invalid: asks to correct the dates", () => {
    const out = render({ kind: "invalid" });
    expect(out).toContain("Correct your dates to see a summary.");
    expect(out).not.toContain("Choose your dates");
  });

  it("filled (Figma 02): type with its dashboard icon, range, working days and balance after", () => {
    const out = render(ready());
    expect(out).toContain("sun.svg");
    expect(out).toContain("Vacation");
    expect(out).toContain("Mon 2 Nov – Wed 4 Nov 2026");
    expect(out).toContain("3 working days (Mon-Fri)");
    expect(out).toContain("Balance after this request:");
    expect(out).toContain("<strong>7 days</strong>");
    expect(out).not.toContain("text-warn-fg");
  });

  it("over balance (Figma 06): the balance line is in the warning colour and reads −1 day", () => {
    const out = render(
      ready({ days: 11, balanceAfter: -1, balanceAfterText: "−1 day", over: true }),
    );
    expect(out).toContain("text-warn-fg");
    expect(out).toContain("<strong>−1 day</strong>");
    expect(out).not.toContain("−1 days");
  });

  it("a type with no balance says so instead of a balance line", () => {
    const out = render(
      ready({ leaveTypeName: "Unpaid", balanceAfter: null, balanceAfterText: null }),
    );
    expect(out).toContain("calendar-minus.svg");
    expect(out).toContain("This leave type has no balance limit.");
    expect(out).not.toContain("Balance after");
  });

  it("shows the reviewer, including the HR fallback, and hides the row when unknown", () => {
    expect(render(ready(), "Hana Reyes")).toContain("Hana Reyes");
    expect(render({ kind: "empty" }, "HR")).toMatch(/Reviewer<\/span><span[^>]*>HR</);
    expect(render(ready(), null)).not.toContain("Reviewer");
  });
});
