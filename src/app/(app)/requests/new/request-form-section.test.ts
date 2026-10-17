import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BalanceSummaryItem } from "@/lib/leave/balance";

const svc = vi.hoisted(() => ({ getBalanceSummary: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("@/lib/leave/service", () => ({
  requireDb: () => ({}),
  getBalanceSummary: svc.getBalanceSummary,
}));

const { RequestFormSection } = await import("./request-form-section");

const TYPES: BalanceSummaryItem[] = [
  {
    leaveTypeId: "t1",
    leaveTypeName: "Vacation",
    tracksBalance: true,
    confirmed: 12,
    pending: 0,
    available: 12,
  },
];
const render = async () => renderToStaticMarkup(await RequestFormSection({ userId: "u1" }));

beforeEach(() => vi.clearAllMocks());

describe("RequestFormSection", () => {
  it("renders the form with the user's leave types", async () => {
    svc.getBalanceSummary.mockResolvedValue(TYPES);
    const out = await render();
    expect(out).toContain('name="leave_type_id"');
    expect(out).toContain("Vacation");
    expect(svc.getBalanceSummary).toHaveBeenCalledWith({}, "u1");
  });

  it("shows an alert and a retry link instead of crashing when the read fails", async () => {
    svc.getBalanceSummary.mockRejectedValue(new Error("boom"));
    const out = await render();
    expect(out).toContain('role="alert"');
    expect(out).toContain("could not be loaded");
    expect(out).toContain('href="/requests/new"');
    expect(out).not.toContain('name="leave_type_id"');
  });

  it("says no leave types are set up when there are none", async () => {
    svc.getBalanceSummary.mockResolvedValue([]);
    expect(await render()).toContain("No leave types are set up yet.");
  });
});
