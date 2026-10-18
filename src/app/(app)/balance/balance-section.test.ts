import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BalanceBreakdownItem } from "@/lib/leave/breakdown";
import type { BalancePage } from "@/lib/leave/service";

const svc = vi.hoisted(() => ({ getBalancePage: vi.fn() }));
const accrual = vi.hoisted(() => ({ getLastAccrualPeriod: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("@/lib/leave/service", () => ({
  requireDb: () => ({}),
  getBalancePage: svc.getBalancePage,
}));
vi.mock("@/lib/leave/accrual", () => ({ getLastAccrualPeriod: accrual.getLastAccrualPeriod }));

const { BalanceSection } = await import("./balance-section");

const VACATION: BalanceBreakdownItem = {
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
const UNPAID: BalanceBreakdownItem = {
  leaveTypeId: "t3",
  leaveTypeName: "Unpaid",
  tracksBalance: false,
  confirmed: null,
  pending: 0,
  available: null,
  usedThisYear: 2,
  accruedThisYear: null,
  openingBalance: null,
};
const REQUEST = {
  id: "r1",
  leave_type_id: "t1",
  start_date: "2026-03-02",
  end_date: "2026-03-04",
  reason: "",
  status: "approved" as const,
  created_at: new Date("2026-02-20T00:00:00Z"),
  decided_at: null,
  decision_note: null,
  working_days: 3,
};
const PAGE: BalancePage = { balances: [VACATION, UNPAID], requests: [REQUEST] };
const render = async () =>
  renderToStaticMarkup(await BalanceSection({ userId: "u1", today: "2026-10-18" }));
const count = (text: string, needle: string) => text.split(needle).length - 1;

beforeEach(() => vi.clearAllMocks());

describe("BalanceSection", () => {
  it("shows the balances and the accrual month when both reads succeed", async () => {
    svc.getBalancePage.mockResolvedValue(PAGE);
    accrual.getLastAccrualPeriod.mockResolvedValue("2026-10");
    const out = await render();
    expect(out).toContain("12 days");
    expect(out).toContain("last monthly accrual (October 2026)");
  });

  it("B1: shows the breakdown lines for a tracked type, and a card per leave type", async () => {
    svc.getBalancePage.mockResolvedValue(PAGE);
    accrual.getLastAccrualPeriod.mockResolvedValue("2026-10");
    const out = await render();
    for (const label of [
      "Available after pending",
      "Opening balance",
      "Accrued this year",
      "Used this year",
      "Pending approval",
    ]) {
      expect(out).toContain(label);
    }
    expect(out).toMatch(/<h2[^>]*>Vacation<\/h2>/);
    expect(out).toMatch(/<h2[^>]*>Unpaid<\/h2>/);
  });

  it("R4: explains the equation once on the page, not on each card", async () => {
    svc.getBalancePage.mockResolvedValue(PAGE);
    accrual.getLastAccrualPeriod.mockResolvedValue("2026-10");
    const out = await render();
    expect(count(out, "Opening balance + accrued this year")).toBe(1);
    expect(count(out, "Includes approved leave you have not taken yet.")).toBe(1);
  });

  it("R5: adds the Adjustments sentence only when a card shows Adjustments", async () => {
    accrual.getLastAccrualPeriod.mockResolvedValue("2026-10");
    svc.getBalancePage.mockResolvedValue(PAGE);
    expect(await render()).not.toContain("Adjustments appears instead");

    svc.getBalancePage.mockResolvedValue({
      ...PAGE,
      balances: [{ ...VACATION, openingBalance: -5, confirmed: 10, available: 8 }, UNPAID],
    });
    const out = await render();
    expect(out).toContain("Adjustments appears instead of the opening balance");
    expect(count(out, "Adjustments appears instead")).toBe(1);
  });

  it("shows the requests card under the cards", async () => {
    svc.getBalancePage.mockResolvedValue(PAGE);
    accrual.getLastAccrualPeriod.mockResolvedValue("2026-10");
    const out = await render();
    expect(out).toMatch(/<h2[^>]*>My requests<\/h2>/);
    expect(out).toContain('aria-label="My leave requests"');
    expect(out.indexOf("My requests")).toBeGreaterThan(out.indexOf("Opening balance + accrued"));
  });

  it("R6: shows the empty state instead of the cards when there is nothing set up, and still lists requests", async () => {
    accrual.getLastAccrualPeriod.mockResolvedValue(null);
    svc.getBalancePage.mockResolvedValue({
      balances: [
        {
          ...VACATION,
          confirmed: 0,
          pending: 0,
          available: 0,
          usedThisYear: 0,
          accruedThisYear: 0,
          openingBalance: 0,
        },
        { ...UNPAID, usedThisYear: 0 },
      ],
      requests: [],
    });
    const out = await render();
    expect(out).toContain("No balance set up yet for your account.");
    expect(out).toContain("Contact your manager or HR for assistance.");
    expect(out).not.toContain("How your balance is built");
    expect(out).not.toContain("Opening balance + accrued this year");
    expect(out).toMatch(/<h2[^>]*>My requests<\/h2>/);
  });

  it("R6: does not show the empty state to someone at 0 days who has used days", async () => {
    accrual.getLastAccrualPeriod.mockResolvedValue("2026-10");
    svc.getBalancePage.mockResolvedValue({
      balances: [
        {
          ...VACATION,
          confirmed: 0,
          pending: 0,
          available: 0,
          usedThisYear: 10,
          openingBalance: 5,
        },
      ],
      requests: [],
    });
    const out = await render();
    expect(out).not.toContain("No balance set up yet");
    expect(out).toContain("How your balance is built");
  });

  it("B14: still shows the balances when only the accrual caption cannot be read", async () => {
    svc.getBalancePage.mockResolvedValue(PAGE);
    accrual.getLastAccrualPeriod.mockRejectedValue(new Error("boom"));
    const out = await render();
    expect(out).toContain("12 days");
    expect(out).not.toContain("last monthly accrual");
    expect(out).not.toContain('role="alert"');
  });

  it("R7: says so, with a way to retry, when the balances cannot be read", async () => {
    svc.getBalancePage.mockRejectedValue(new Error("boom"));
    accrual.getLastAccrualPeriod.mockResolvedValue("2026-10");
    const out = await render();
    expect(out).toContain('role="alert"');
    expect(out).toContain("Your balance could not be loaded right now.");
    expect(out).toContain("Try again in a moment.");
    expect(out).toContain('href="/balance"');
    expect(out).not.toContain("How your balance is built");
  });

  it("reads only the signed-in user's own page, for the calendar year of today", async () => {
    svc.getBalancePage.mockResolvedValue(PAGE);
    accrual.getLastAccrualPeriod.mockResolvedValue(null);
    await render();
    expect(svc.getBalancePage).toHaveBeenCalledWith({}, "u1", {
      year: 2026,
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });
});
