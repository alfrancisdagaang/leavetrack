import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BalanceBreakdownItem } from "@/lib/leave/breakdown";
import { BalanceEmpty, BalanceError, BalanceNote, isBalanceEmpty } from "./balance-states";

const item = (over: Partial<BalanceBreakdownItem> = {}): BalanceBreakdownItem => ({
  leaveTypeId: "t1",
  leaveTypeName: "Vacation",
  tracksBalance: true,
  confirmed: 0,
  pending: 0,
  available: 0,
  usedThisYear: 0,
  accruedThisYear: 0,
  openingBalance: 0,
  ...over,
});
const UNPAID = item({
  leaveTypeId: "t3",
  leaveTypeName: "Unpaid",
  tracksBalance: false,
  confirmed: null,
  available: null,
  accruedThisYear: null,
  openingBalance: null,
});

describe("isBalanceEmpty (R6: the safe rule)", () => {
  it("is empty when no tracked type has a balance, accrual, used days or pending days", () => {
    expect(
      isBalanceEmpty([item(), item({ leaveTypeId: "t2", leaveTypeName: "Sick" }), UNPAID]),
    ).toBe(true);
    expect(isBalanceEmpty([])).toBe(true);
  });

  it("is NOT empty for someone who spent every day: a 0 balance with used days still shows the breakdown", () => {
    expect(isBalanceEmpty([item({ confirmed: 0, usedThisYear: 5, openingBalance: 5 })])).toBe(
      false,
    );
  });

  it("is not empty with a balance, an accrual or a pending request", () => {
    expect(isBalanceEmpty([item({ confirmed: 3 })])).toBe(false);
    expect(isBalanceEmpty([item({ accruedThisYear: 1.25 })])).toBe(false);
    expect(isBalanceEmpty([item({ pending: 2 })])).toBe(false);
  });

  it("looks only at tracked types (an Unpaid request alone does not make a balance)", () => {
    expect(isBalanceEmpty([item(), { ...UNPAID, usedThisYear: 4, pending: 1 }])).toBe(true);
  });
});

describe("BalanceNote (R4, R5: the one note under the cards)", () => {
  const out = renderToStaticMarkup(BalanceNote({ adjustments: false }));

  it("explains the equation and the used days, as a note with the info icon", () => {
    expect(out).toContain('role="note"');
    expect(out).toContain(
      "Opening balance + accrued this year − used this year = confirmed balance.",
    );
    expect(out).toContain("Includes approved leave you have not taken yet.");
    expect(out).toContain("info.svg");
    expect(out).toContain('alt=""');
  });

  it("adds the Adjustments sentence only when a card shows Adjustments", () => {
    const sentence =
      "Adjustments appears instead of the opening balance when it would be negative.";
    expect(out).not.toContain(sentence);
    expect(renderToStaticMarkup(BalanceNote({ adjustments: true }))).toContain(sentence);
  });
});

describe("BalanceError (R7)", () => {
  const out = renderToStaticMarkup(BalanceError());

  it("announces the problem, says to try again, and offers a Try again link", () => {
    expect(out).toContain('role="alert"');
    expect(out).toContain("Your balance could not be loaded right now.");
    expect(out).toContain("Try again in a moment.");
    expect(out).toMatch(/<a [^>]*href="\/balance"[^>]*>Try again<\/a>/);
    expect(out).toContain("circle-alert.svg");
  });

  it("keeps the link outside the alert, so only the message is announced", () => {
    const alert = out.slice(
      out.indexOf('role="alert"'),
      out.indexOf("</div>", out.indexOf('role="alert"')),
    );
    expect(alert).not.toContain("<a ");
  });

  it("uses tokens only", () => {
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(|hsl\(|style="(?!color:transparent")/);
  });
});

describe("BalanceEmpty (R6)", () => {
  const out = renderToStaticMarkup(BalanceEmpty());

  it("shows the clipboard icon and both sentences", () => {
    expect(out).toContain("clipboard-list.svg");
    expect(out).toContain("No balance set up yet for your account.");
    expect(out).toContain("Contact your manager or HR for assistance.");
  });

  it("is not an alert (nothing failed) and uses tokens only", () => {
    expect(out).not.toContain('role="alert"');
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(|hsl\(|style="(?!color:transparent")/);
  });
});
