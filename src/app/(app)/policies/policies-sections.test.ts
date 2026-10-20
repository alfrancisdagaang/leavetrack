import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_POLICY_QUERY } from "@/lib/leave/policies-schema";

const reads = vi.hoisted(() => ({
  getPolicyPage: vi.fn(),
  getPolicyChoices: vi.fn(),
  getRecentPolicyChanges: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  unstable_rethrow: () => {},
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/lib/db/timed", () => ({ timedRead: (_n: string, fn: () => unknown) => fn() }));
const DB = { db: true };
vi.mock("@/lib/leave/service", () => ({ requireDb: () => DB }));
vi.mock("@/lib/leave/policies", () => reads);
const warn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({ logger: { warn } }));

const { PolicyListSection, RecentChangesSection } = await import("./policies-sections");
const html = async (p: Promise<ReactElement>) => renderToStaticMarkup(await p);

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const people = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `u${i}`,
    name: `Person ${i}`,
    managerName: "Marco Santos",
    lastChange: null,
    rates: [
      { leaveTypeId: VAC, leaveTypeName: "Vacation", rate: "1.25" },
      { leaveTypeId: SICK, leaveTypeName: "Sick", rate: null },
    ],
  }));
const SUMMARY = { employees: 1248, noPolicy: 37, changedThisMonth: 12 };
const page = (n: number, total = n, over = {}) => ({
  total,
  page: 1,
  pageSize: 25,
  summary: SUMMARY,
  people: people(n),
  ...over,
});
const CHOICES = { managers: [{ id: "m1", name: "Marco Santos" }], leaveTypes: [] };
const props = { viewerId: "h1", query: DEFAULT_POLICY_QUERY, timeZone: "Asia/Manila" };

beforeEach(() => {
  vi.clearAllMocks();
  reads.getPolicyChoices.mockResolvedValue(CHOICES);
});

describe("PolicyListSection", () => {
  it("AC1: reads for the SESSION user, the page and the filter choices (two statements), and shows tiles, filters, table and pager", async () => {
    reads.getPolicyPage.mockResolvedValue(page(2, 60));
    const out = await html(
      PolicyListSection({
        ...props,
        query: { ...DEFAULT_POLICY_QUERY, q: "per", sort: "sick", per: 50 },
      }),
    );
    expect(reads.getPolicyPage).toHaveBeenCalledWith(DB, {
      ...DEFAULT_POLICY_QUERY,
      q: "per",
      sort: "sick",
      per: 50,
      viewerId: "h1",
      timeZone: "Asia/Manila",
    });
    expect(reads.getPolicyChoices).toHaveBeenCalledWith(DB, "h1");
    expect(out).toContain("1,248"); // tiles
    expect(out).toContain('role="search"'); // filters
    expect(out).toContain("Employees (60)"); // table card
    expect(out).toContain("Person 0");
    expect(out).toContain("Pagination");
  });

  it("the table is re-created per address, so another page or filter never keeps stale edits", async () => {
    reads.getPolicyPage.mockResolvedValue(page(1));
    const out = await html(PolicyListSection(props));
    expect(out).toContain("Employees (1)");
  });

  it("says so when nothing matches the filters, with a way to clear them", async () => {
    reads.getPolicyPage.mockResolvedValue(page(0, 0));
    const out = await html(
      PolicyListSection({
        ...props,
        query: { ...DEFAULT_POLICY_QUERY, q: "zzz", status: "none", sort: "sick" },
      }),
    );
    expect(out).toContain("No employees match “zzz” with these filters.");
    expect(out).toContain('href="/policies?sort=sick"');
  });

  it("says so when there are no employees at all", async () => {
    reads.getPolicyPage.mockResolvedValue(page(0, 0));
    expect(await html(PolicyListSection(props))).toContain("There are no employees yet.");
  });

  it("a failed page read is an alert with a way to retry, logged, and never throws", async () => {
    reads.getPolicyPage.mockRejectedValue(new Error("db down"));
    const out = await html(
      PolicyListSection({ ...props, query: { ...DEFAULT_POLICY_QUERY, q: "a", page: 2 } }),
    );
    expect(out).toContain('role="alert"');
    expect(out).toContain("could not be loaded");
    expect(out).toContain("/policies?q=a&amp;page=2");
    expect(warn).toHaveBeenCalled();
  });

  it("if only the filter choices cannot be read the list still works, without the team and type lists", async () => {
    reads.getPolicyPage.mockResolvedValue(page(2));
    reads.getPolicyChoices.mockRejectedValue(new Error("no"));
    const out = await html(PolicyListSection(props));
    expect(out).toContain("Employees (2)");
    expect(out).toContain("All teams");
    expect(out).not.toContain("Marco Santos</option>");
    expect(warn).toHaveBeenCalled();
  });
});

describe("RecentChangesSection", () => {
  it("lists who changed whose rate, with the time in the given zone, for the SESSION user", async () => {
    reads.getRecentPolicyChanges.mockResolvedValue([
      {
        id: "c1",
        employeeName: "Elena Cruz",
        leaveTypeName: "Vacation",
        changedByName: "Hana Reyes",
        oldRate: "1.25",
        newRate: "1.50",
        changedAt: "2026-10-20T01:41:00.000Z",
      },
    ]);
    const out = await html(RecentChangesSection({ viewerId: "h1", timeZone: "Asia/Manila" }));
    expect(reads.getRecentPolicyChanges).toHaveBeenCalledWith(DB, "h1");
    expect(out).toContain(
      "Hana Reyes changed Elena Cruz&#x27;s Vacation rate from 1.25 to 1.5 days a month",
    );
    expect(out).toContain("Oct 20, 2026, 9:41 AM");
  });

  it("says so when nothing has changed yet", async () => {
    reads.getRecentPolicyChanges.mockResolvedValue([]);
    expect(await html(RecentChangesSection({ viewerId: "h1", timeZone: "UTC" }))).toContain(
      "No rate has been changed yet.",
    );
  });

  it("a failure is a note with a retry link, so the list still works", async () => {
    reads.getRecentPolicyChanges.mockRejectedValue(new Error("no such table"));
    const out = await html(RecentChangesSection({ viewerId: "h1", timeZone: "UTC" }));
    expect(out).toContain("Recent changes could not be loaded");
    expect(out).toContain('href="/policies"');
  });
});
