import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queue = vi.hoisted(() => ({ getOverrideQueue: vi.fn(), getRecentOverrides: vi.fn() }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: () => {},
  useRouter: () => ({ refresh: () => {} }),
}));
vi.mock("@/lib/db/timed", () => ({ timedRead: (_n: string, fn: () => unknown) => fn() }));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => ({}) }));
vi.mock("@/lib/leave/override-queue", () => queue);
vi.mock("@/lib/logger", () => ({ logger: { warn: () => {} } }));

const { OverrideQueueSection, RecentOverridesSection } = await import("./override-sections");
const html = async (p: Promise<ReactElement | null>) => {
  const el = await p;
  return el ? renderToStaticMarkup(el) : "";
};

const queued = (id: string) => ({
  id,
  employee_name: "Elena Cruz",
  manager_name: "Marco Santos",
  leave_type_name: "Vacation",
  start_date: "2026-11-02",
  end_date: "2026-11-06",
  reason: "Family trip",
  created_at: new Date("2026-10-18T00:00:00Z"),
  working_days: 5,
  balance: "2.00",
  shortfall: "3.00",
});

beforeEach(() => vi.clearAllMocks());

describe("OverrideQueueSection", () => {
  it("passes the session HR id to the query and shows the count", async () => {
    queue.getOverrideQueue.mockResolvedValue({ rows: [], total: 0 });
    const out = await html(OverrideQueueSection({ hrId: "h1" }));
    expect(queue.getOverrideQueue).toHaveBeenCalledWith({}, "h1");
    expect(out).toContain("Waiting for an override (0)");
  });

  it("AC4: an empty queue shows an empty state", async () => {
    queue.getOverrideQueue.mockResolvedValue({ rows: [], total: 0 });
    expect(await html(OverrideQueueSection({ hrId: "h1" }))).toContain(
      "No requests are waiting for an HR override.",
    );
  });

  it("AC2: lists a row per request with the shortfall written out", async () => {
    queue.getOverrideQueue.mockResolvedValue({ rows: [queued("a"), queued("b")], total: 2 });
    const out = await html(OverrideQueueSection({ hrId: "h1" }));
    expect(out).toContain("Waiting for an override (2)");
    expect(out).toContain("2 pending");
    expect(out.match(/Over balance by 3 days/g)).toHaveLength(2);
    expect(out).not.toContain("Showing the oldest");
  });

  it("says so when more requests wait than the page lists (the cap of 50)", async () => {
    queue.getOverrideQueue.mockResolvedValue({ rows: [queued("a")], total: 51 });
    const out = await html(OverrideQueueSection({ hrId: "h1" }));
    expect(out).toContain("Waiting for an override (51)");
    expect(out).toContain("Showing the oldest 1 of 51.");
  });

  it("AC4: a failed read shows an alert with a retry, not an error page", async () => {
    queue.getOverrideQueue.mockRejectedValue(new Error("boom"));
    const out = await html(OverrideQueueSection({ hrId: "h1" }));
    expect(out).toContain('role="alert"');
    expect(out).toContain("could not be loaded");
    expect(out).toContain('href="/approvals/overrides"');
  });
});

describe("RecentOverridesSection", () => {
  const now = new Date("2026-10-19T09:00:00Z");

  it("renders nothing when nothing was overridden", async () => {
    queue.getRecentOverrides.mockResolvedValue([]);
    expect(await html(RecentOverridesSection({ now, timeZone: "UTC" }))).toBe("");
  });

  it("lists the override approvals with who approved and the shortfall", async () => {
    queue.getRecentOverrides.mockResolvedValue([
      {
        id: "e1",
        employee_name: "Elena Cruz",
        leave_type_name: "Vacation",
        start_date: "2026-11-02",
        end_date: "2026-11-06",
        approved_by_name: "Hana Reyes",
        occurred_at: new Date("2026-10-19T01:42:00Z"),
        days_requested: "5.00",
        shortfall: "3.00",
      },
    ]);
    const out = await html(RecentOverridesSection({ now, timeZone: "UTC" }));
    expect(out).toContain("Recently overridden");
    expect(out).toContain("1 recent");
    expect(out).toContain("Approved (HR override)");
    expect(out).toContain("Shortfall: 3 days");
    expect(out).toContain("By Hana Reyes");
    expect(out).toContain("Today, Oct 19");
  });

  it("a failed read degrades to a note, so the queue above still works", async () => {
    queue.getRecentOverrides.mockRejectedValue(new Error("boom"));
    expect(await html(RecentOverridesSection({ now, timeZone: "UTC" }))).toContain(
      "could not be loaded",
    );
  });
});
