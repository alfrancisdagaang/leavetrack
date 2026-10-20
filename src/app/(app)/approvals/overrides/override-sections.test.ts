import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_OVERRIDE_QUERY, parseOverrideListQuery } from "@/lib/leave/override-list-schema";
import type { OverrideQueueRow, RecentOverrideView } from "@/lib/leave/override-queue";

const reads = vi.hoisted(() => ({
  getOverrideQueuePage: vi.fn(),
  getOverriddenPage: vi.fn(),
  getOverrideChoices: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  unstable_rethrow: () => {},
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/lib/db/timed", () => ({ timedRead: (_n: string, fn: () => unknown) => fn() }));
const DB = { db: true };
vi.mock("@/lib/leave/service", () => ({ requireDb: () => DB }));
vi.mock("@/lib/leave/override-lists", () => reads);
const warn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({ logger: { warn } }));

const { OverridesSection } = await import("./override-sections");
const html = async (p: Promise<ReactElement>) => renderToStaticMarkup(await p);

const NOW = new Date("2026-10-19T09:00:00Z");
const waitingRow = (i: number): OverrideQueueRow => ({
  id: `r${i}`,
  employee_name: `Person ${i}`,
  manager_name: "Marco Santos",
  leave_type_name: "Vacation",
  start_date: "2026-11-02",
  end_date: "2026-11-04",
  reason: i === 0 ? "Family trip" : "",
  created_at: new Date("2026-10-14T00:00:00Z"),
  working_days: 3,
  balance: "0.00",
  shortfall: "3.00",
});
const doneRow = (i: number): RecentOverrideView => ({
  id: `a${i}`,
  employee_name: `Person ${i}`,
  leave_type_name: "Sick",
  start_date: "2026-12-08",
  end_date: "2026-12-12",
  approved_by_name: "Hana Reyes",
  occurred_at: new Date("2026-10-03T10:00:00Z"),
  days_requested: "5.00",
  shortfall: "5.00",
});
const WSUM = { waiting: 120, biggestShortfall: "6.50", oldestDays: 9 };
const waitingPage = (n: number, total = n) => ({
  total,
  page: 1,
  pageSize: 25,
  summary: WSUM,
  rows: Array.from({ length: n }, (_, i) => waitingRow(i)),
});
const donePage = (n: number, total = n) => ({
  total,
  page: 1,
  pageSize: 25,
  summary: { total: 14, totalShortfall: "31.50", thisMonth: 3 },
  rows: Array.from({ length: n }, (_, i) => doneRow(i)),
});
const CHOICES = {
  leaveTypes: [{ id: "10000000-0000-4000-8000-000000000001", name: "Vacation" }],
  managers: [{ id: "00000000-0000-4000-8000-000000000002", name: "Marco Santos" }],
};
const props = (query = DEFAULT_OVERRIDE_QUERY) => ({
  hrId: "h1",
  query,
  now: NOW,
  timeZone: "Asia/Manila",
});

beforeEach(() => {
  vi.clearAllMocks();
  reads.getOverrideChoices.mockResolvedValue(CHOICES);
});

describe("OverridesSection, waiting view", () => {
  it("reads for the SESSION HR user and shows tiles, filters, the table, cards and the pager", async () => {
    reads.getOverrideQueuePage.mockResolvedValue(waitingPage(2, 120));
    const out = await html(
      OverridesSection(props(parseOverrideListQuery({ q: "per", sort: "shortfall" }).query)),
    );
    expect(reads.getOverrideQueuePage).toHaveBeenCalledWith(DB, {
      ...DEFAULT_OVERRIDE_QUERY,
      q: "per",
      sort: "shortfall",
      dir: "desc",
      hrId: "h1",
    });
    expect(reads.getOverrideChoices).toHaveBeenCalledWith(DB, "h1");
    expect(out).toContain(">120<");
    expect(out).toContain("waiting for an override");
    expect(out).toContain(">6.5<"); // biggest shortfall, as a number
    expect(out).toContain("days over balance at most");
    expect(out).toContain("Waiting for an override (120)");
    expect(out).toContain("Over balance by 3 days");
    expect(out).toContain("Approve override");
    expect(out).toContain("Pagination");
    expect(out).toContain("Marco Santos</option>"); // the Team filter
  });

  it("HR can see that more than 50 wait: the count is the true total, not a cap", async () => {
    reads.getOverrideQueuePage.mockResolvedValue(waitingPage(25, 120));
    const out = await html(OverridesSection(props()));
    expect(out).toContain("Waiting for an override (120)");
    expect(out).toContain("Showing 1 to 25 of 120");
    expect(out).not.toContain("Showing the oldest");
  });

  it("says so when nothing matches, with a way to clear, and when nothing waits", async () => {
    reads.getOverrideQueuePage.mockResolvedValue(waitingPage(0, 0));
    const q = parseOverrideListQuery({
      q: "zzz",
      team: "00000000-0000-4000-8000-000000000002",
    }).query;
    const out = await html(OverridesSection(props(q)));
    expect(out).toContain("No requests waiting for an override match these filters.");
    expect(out).toContain('href="/approvals/overrides"');
    expect(await html(OverridesSection(props()))).toContain(
      "No requests are waiting for an HR override.",
    );
  });

  it("a failed read is an alert that retries the same address, logged, and never throws", async () => {
    reads.getOverrideQueuePage.mockRejectedValue(new Error("db down"));
    const out = await html(
      OverridesSection(props(parseOverrideListQuery({ q: "a", page: "2" }).query)),
    );
    expect(out).toContain('role="alert"');
    expect(out).toContain("Override requests could not be loaded");
    expect(out).toContain("/approvals/overrides?q=a&amp;page=2");
    expect(warn).toHaveBeenCalled();
  });

  it("if only the filter choices cannot be read the list still works", async () => {
    reads.getOverrideQueuePage.mockResolvedValue(waitingPage(2));
    reads.getOverrideChoices.mockRejectedValue(new Error("no"));
    const out = await html(OverridesSection(props()));
    expect(out).toContain("Waiting for an override (2)");
    expect(out).toContain("All teams");
    expect(out).not.toContain("Marco Santos</option>");
  });
});

describe("OverridesSection, overridden view", () => {
  const overridden = parseOverrideListQuery({ view: "overridden" }).query;

  it("reads the overridden page for the session HR user with the time zone", async () => {
    reads.getOverriddenPage.mockResolvedValue(donePage(2, 14));
    const out = await html(OverridesSection(props(overridden)));
    expect(reads.getOverriddenPage).toHaveBeenCalledWith(DB, {
      ...overridden,
      hrId: "h1",
      timeZone: "Asia/Manila",
    });
    expect(reads.getOverrideQueuePage).not.toHaveBeenCalled();
    expect(out).toContain("Overridden requests (14)");
    expect(out).toContain("overrides approved");
    expect(out).toContain(">31.5<");
    expect(out).toContain("By Hana Reyes");
  });

  it("says so when nothing was overridden, and when nothing matches", async () => {
    reads.getOverriddenPage.mockResolvedValue(donePage(0, 0));
    expect(await html(OverridesSection(props(overridden)))).toContain(
      "No request has been overridden yet.",
    );
    const q = parseOverrideListQuery({ view: "overridden", q: "zzz" }).query;
    expect(await html(OverridesSection(props(q)))).toContain(
      "No overridden requests match these filters.",
    );
  });

  it("a failed read is an alert that retries the overridden view", async () => {
    reads.getOverriddenPage.mockRejectedValue(new Error("db down"));
    const out = await html(OverridesSection(props(overridden)));
    expect(out).toContain("Overridden requests could not be loaded");
    expect(out).toContain("/approvals/overrides?view=overridden");
  });
});
