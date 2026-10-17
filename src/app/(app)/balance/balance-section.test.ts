import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MySummary } from "@/lib/leave/service";

const svc = vi.hoisted(() => ({ getMySummary: vi.fn() }));
const accrual = vi.hoisted(() => ({ getLastAccrualPeriod: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => ({}), getMySummary: svc.getMySummary }));
vi.mock("@/lib/leave/accrual", () => ({ getLastAccrualPeriod: accrual.getLastAccrualPeriod }));

const { BalanceSection } = await import("./balance-section");

const SUMMARY: MySummary = {
  balances: [
    {
      leaveTypeId: "t1",
      leaveTypeName: "Vacation",
      tracksBalance: true,
      confirmed: 12,
      pending: 2,
      available: 10,
    },
  ],
  requests: [],
};
const render = async () => renderToStaticMarkup(await BalanceSection({ userId: "u1" }));

beforeEach(() => vi.clearAllMocks());

describe("BalanceSection", () => {
  it("shows the balances and the accrual month when both reads succeed", async () => {
    svc.getMySummary.mockResolvedValue(SUMMARY);
    accrual.getLastAccrualPeriod.mockResolvedValue("2026-10");
    const out = await render();
    expect(out).toContain("12 days");
    expect(out).toContain("last monthly accrual (October 2026)");
  });

  it("still shows the balances when only the accrual caption cannot be read", async () => {
    svc.getMySummary.mockResolvedValue(SUMMARY);
    accrual.getLastAccrualPeriod.mockRejectedValue(new Error("boom"));
    const out = await render();
    expect(out).toContain("12 days");
    expect(out).not.toContain("last monthly accrual");
    expect(out).not.toContain('role="alert"');
  });

  it("says so, with a way to retry, when the balances cannot be read", async () => {
    svc.getMySummary.mockRejectedValue(new Error("boom"));
    accrual.getLastAccrualPeriod.mockResolvedValue("2026-10");
    const out = await render();
    expect(out).toContain('role="alert"');
    expect(out).toContain("could not be loaded");
    expect(out).toContain('href="/balance"');
  });

  it("reads only the signed-in user's own summary", async () => {
    svc.getMySummary.mockResolvedValue(SUMMARY);
    accrual.getLastAccrualPeriod.mockResolvedValue(null);
    await render();
    expect(svc.getMySummary).toHaveBeenCalledWith({}, "u1");
  });
});
