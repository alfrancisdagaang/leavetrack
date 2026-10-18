import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BalanceBreakdownItem } from "@/lib/leave/breakdown";
import { BalanceCard, formatDays, reconciliationLabel } from "./balance-card";

const TRACKED: BalanceBreakdownItem = {
  leaveTypeId: "t1",
  leaveTypeName: "Vacation",
  tracksBalance: true,
  confirmed: 12,
  pending: 2,
  available: 10,
  usedThisYear: 5,
  accruedThisYear: 15,
  openingBalance: 2,
};
const SICK: BalanceBreakdownItem = { ...TRACKED, leaveTypeId: "t2", leaveTypeName: "Sick" };
const UNPAID: BalanceBreakdownItem = {
  leaveTypeId: "t3",
  leaveTypeName: "Unpaid",
  tracksBalance: false,
  confirmed: null,
  pending: 1,
  available: null,
  usedThisYear: 2,
  accruedThisYear: null,
  openingBalance: null,
};
const html = (item: BalanceBreakdownItem) => renderToStaticMarkup(BalanceCard({ item }));
const count = (text: string, needle: string) => text.split(needle).length - 1;

describe("formatDays", () => {
  it("uses singular and plural, keeps decimals as stored, and writes negatives with a minus sign", () => {
    expect(formatDays(1)).toBe("1 day");
    expect(formatDays(0)).toBe("0 days");
    expect(formatDays(12)).toBe("12 days");
    expect(formatDays(11.25)).toBe("11.25 days");
    expect(formatDays(-3)).toBe("−3 days");
  });
});

describe("BalanceCard header (R1: icon tile and chip per type)", () => {
  it("shows the type's icon on its tint, its name as a heading, and a Tracked chip", () => {
    const out = html(TRACKED);
    expect(out).toContain('src="/icons/sun.svg"'.replace("src=", "")); // next/image rewrites the src
    expect(out).toContain("bg-leave-vacation/10");
    expect(out).toMatch(/<h2[^>]*>Vacation<\/h2>/);
    expect(out).toContain(">Tracked<");
  });

  it("uses the heart for Sick and the calendar for Unpaid, each on its own tint", () => {
    expect(html(SICK)).toContain("heart-pulse.svg");
    expect(html(SICK)).toContain("bg-leave-sick/10");
    expect(html(UNPAID)).toContain("calendar-minus.svg");
    expect(html(UNPAID)).toContain("bg-leave-unpaid/10");
  });

  it("hides the decorative tile from assistive technology", () => {
    expect(html(TRACKED)).toMatch(
      /<span aria-hidden="true" class="flex size-9[^"]*bg-leave-vacation/,
    );
  });

  it("marks an untracked type as Not tracked", () => {
    expect(html(UNPAID)).toContain(">Not tracked<");
    expect(html(UNPAID)).not.toContain(">Tracked<");
  });
});

describe("BalanceCard (B1, R2: a tracked type)", () => {
  it("shows available, pending, used, accrued and the derived opening balance", () => {
    const out = html(TRACKED);
    for (const label of [
      "Available after pending",
      "Opening balance",
      "Accrued this year",
      "Used this year",
      "Confirmed balance",
      "Pending approval",
    ]) {
      expect(out).toContain(label);
    }
    for (const value of ["10 days", "15 days", "5 days", "12 days", "2 days"]) {
      expect(out).toContain(value);
    }
  });

  it("R2: the big number comes before its label", () => {
    const out = html(TRACKED);
    expect(out.indexOf("10 days")).toBeGreaterThan(-1);
    expect(out.indexOf("10 days")).toBeLessThan(out.indexOf("Available after pending"));
  });

  it("keeps the two groups labelled by their headings (a role=group, never a named dl)", () => {
    const out = html(TRACKED);
    expect(out).toContain("How your balance is built");
    expect(out).toContain("Set aside");
    expect(out).toMatch(/<div role="group" aria-labelledby="balance-t1-built"><dl/);
    expect(out).toMatch(/<div role="group" aria-labelledby="balance-t1-set-aside"><dl/);
    expect(out).not.toMatch(/<dl[^>]*aria-labelledby/);
  });

  it("shows fractions as stored", () => {
    const out = html({ ...TRACKED, confirmed: 11.25, available: 9.25, accruedThisYear: 1.25 });
    expect(out).toContain("11.25 days");
    expect(out).toContain("1.25 days");
  });
});

describe("BalanceCard sign gutter (R3)", () => {
  it("shows each operator beside its label, hidden from assistive technology", () => {
    const out = html(TRACKED);
    for (const sign of ["+", "−", "="]) {
      expect(out).toContain(
        `<span aria-hidden="true" class="w-4 shrink-0 text-center">${sign}</span>`,
      );
    }
    // The opening line has an empty gutter so the labels still line up.
    expect(out).toContain('<span aria-hidden="true" class="w-4 shrink-0 text-center"></span>');
  });

  it("reads the operator as a word with the value, so the equation works without seeing it", () => {
    const out = html(TRACKED);
    expect(out).toMatch(/<dd[^>]*><span class="sr-only">plus <\/span>15 days<\/dd>/);
    expect(out).toMatch(/<dd[^>]*><span class="sr-only">minus <\/span>5 days<\/dd>/);
    expect(out).toMatch(/<dd[^>]*><span class="sr-only">equals <\/span>12 days<\/dd>/);
  });
});

describe("BalanceCard notes (R4: the explanation is on the page once, not on each card)", () => {
  it("carries no equation or used-days note of its own", () => {
    for (const item of [TRACKED, UNPAID]) {
      const out = html(item);
      expect(out).not.toContain("Includes approved leave");
      expect(out).not.toContain("accrued − used");
      expect(out).not.toContain("accrued this year − used");
    }
  });
});

describe("BalanceCard zero values", () => {
  it("mutes a line whose value is 0 but keeps it, so the equation stays complete", () => {
    const out = html({ ...TRACKED, accruedThisYear: 0, usedThisYear: 0, pending: 0 });
    expect(out).toContain("Accrued this year");
    expect(out).toContain("Used this year");
    expect(count(out, '<dd class="text-right text-ink-muted">')).toBe(3);
    expect(out).toContain('<dd class="text-right font-medium text-ink">'); // the opening line is not 0
  });

  it("never mutes the Confirmed balance line, even at 0", () => {
    const out = html({ ...TRACKED, confirmed: 0, available: -2 });
    expect(out).toMatch(
      /<dd class="text-right font-semibold text-ink"><span class="sr-only">equals <\/span>0 days<\/dd>/,
    );
  });

  it("keeps the sign words for a muted line", () => {
    const out = html({ ...TRACKED, usedThisYear: 0 });
    expect(out).toMatch(
      /<dd class="text-right text-ink-muted"><span class="sr-only">minus <\/span>0 days<\/dd>/,
    );
  });
});

describe("BalanceCard (R10: a negative derived value)", () => {
  it("calls it Adjustments, shows the minus sign, and keeps the equation true", () => {
    expect(reconciliationLabel(-10)).toBe("Adjustments");
    expect(reconciliationLabel(0)).toBe("Opening balance");
    const out = html({ ...TRACKED, openingBalance: -10, confirmed: 5, available: 3 });
    expect(out).toContain("Adjustments");
    expect(out).not.toContain("Opening balance");
    expect(out).toContain("−10 days");
  });
});

describe("BalanceCard (R9: Unpaid)", () => {
  it("shows a dash, the untracked sentence, and only pending and used days", () => {
    const out = html(UNPAID);
    expect(out).toContain(
      '<p aria-hidden="true" class="text-3xl font-bold leading-tight text-ink">—</p>',
    );
    expect(out).toContain("No balance is tracked for this leave type.");
    expect(out).toContain("Pending approval");
    expect(out).toContain("Used this year");
    expect(out).toContain("2 days");
    for (const absent of [
      "Accrued this year",
      "Opening balance",
      "Adjustments",
      "Confirmed balance",
      "Available after pending",
    ]) {
      expect(out).not.toContain(absent);
    }
  });

  it("has no group headings (Used days are not set aside) and no sign gutter", () => {
    const out = html(UNPAID);
    expect(out).not.toMatch(/<h3/);
    expect(out).not.toContain("Set aside");
    expect(out).not.toContain("w-4 shrink-0 text-center");
  });
});

describe("BalanceCard (R12: tokens only)", () => {
  it("has no hard-coded colour or inline style", () => {
    for (const item of [TRACKED, UNPAID, { ...TRACKED, openingBalance: -5 }]) {
      expect(html(item)).not.toMatch(
        /#[0-9a-fA-F]{3,6}\b|rgb\(|hsl\(|style="(?!color:transparent")/,
      );
    }
  });
});
