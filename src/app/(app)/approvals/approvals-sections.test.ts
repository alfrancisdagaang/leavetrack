import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DecidedTeamRequestView, TeamRequestView } from "@/lib/leave/team";
import { DEFAULT_TEAM_QUERY, parseTeamQueueQuery } from "@/lib/leave/team-queue-schema";

const reads = vi.hoisted(() => ({
  getTeamQueuePage: vi.fn(),
  getTeamDecidedPage: vi.fn(),
  getTeamChoices: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  unstable_rethrow: () => {},
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/lib/db/timed", () => ({ timedRead: (_n: string, fn: () => unknown) => fn() }));
const DB = { db: true };
vi.mock("@/lib/leave/service", () => ({ requireDb: () => DB }));
vi.mock("@/lib/leave/team-lists", () => reads);
const warn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", () => ({ logger: { warn } }));

const { ApprovalsSection } = await import("./approvals-sections");
const html = async (p: Promise<ReactElement>) => renderToStaticMarkup(await p);

const NOW = new Date("2026-10-19T09:00:00Z");
const TYPE = "10000000-0000-4000-8000-000000000001";
const pendingRow = (i: number, over: Partial<TeamRequestView> = {}): TeamRequestView => ({
  id: `r${i}`,
  employee_name: `Person ${i}`,
  leave_type_id: TYPE,
  leave_type_name: "Vacation",
  tracks_balance: true,
  start_date: "2026-11-02",
  end_date: "2026-11-04",
  reason: i === 0 ? "Family trip" : "",
  status: "pending",
  created_at: new Date("2026-10-14T00:00:00Z"),
  working_days: 3,
  balance: 10,
  balanceCheck: { kind: "ok" },
  ...over,
});
const decidedRow = (i: number): DecidedTeamRequestView => ({
  id: `d${i}`,
  employee_name: `Person ${i}`,
  leave_type_name: "Sick",
  start_date: "2026-10-01",
  end_date: "2026-10-01",
  status: i === 0 ? "rejected" : "approved",
  decision_note: i === 0 ? "Team is short that week" : null,
  decided_at: new Date("2026-10-02T00:00:00Z"),
  working_days: 1,
  overridden: false,
});
const PSUM = { pending: 7, canApprove: 4, cannotApprove: 3, oldestDays: 5 };
const pendingPage = (n: number, total = n, over = {}) => ({
  total,
  page: 1,
  pageSize: 25,
  summary: PSUM,
  rows: Array.from({ length: n }, (_, i) => pendingRow(i)),
  ...over,
});
const decidedPage = (n: number, total = n) => ({
  total,
  page: 1,
  pageSize: 25,
  summary: { total: 9, approved: 5, rejected: 3, overridden: 1 },
  rows: Array.from({ length: n }, (_, i) => decidedRow(i)),
});
const props = (query = DEFAULT_TEAM_QUERY) => ({
  managerId: "m1",
  query,
  now: NOW,
  timeZone: "Asia/Manila",
});

beforeEach(() => {
  vi.clearAllMocks();
  reads.getTeamChoices.mockResolvedValue({ leaveTypes: [{ id: TYPE, name: "Vacation" }] });
});

describe("ApprovalsSection, pending view", () => {
  it("reads for the SESSION manager (the page and the choices) and shows tiles, filters, the table, cards and the pager", async () => {
    reads.getTeamQueuePage.mockResolvedValue(pendingPage(2, 60));
    const out = await html(
      ApprovalsSection(props(parseTeamQueueQuery({ q: "per", sort: "days", per: "50" }).query)),
    );
    expect(reads.getTeamQueuePage).toHaveBeenCalledWith(DB, {
      ...DEFAULT_TEAM_QUERY,
      q: "per",
      sort: "days",
      dir: "desc",
      per: 50,
      managerId: "m1",
    });
    expect(reads.getTeamChoices).toHaveBeenCalledWith(DB, "m1");
    expect(out).toContain(">7<"); // tiles
    expect(out).toContain("you can approve now");
    expect(out).toContain('role="search"'); // filters
    expect(out).toContain("Pending requests (60)"); // the true total
    expect(out).toContain('aria-label="Pending requests"'); // table and cards
    expect(out).toContain("Person 0");
    expect(out).toContain("Pagination");
    expect(reads.getTeamDecidedPage).not.toHaveBeenCalled();
  });

  it("the tile 'you can approve now' links to that filter and keeps nothing else", async () => {
    reads.getTeamQueuePage.mockResolvedValue(pendingPage(1));
    const out = await html(
      ApprovalsSection(props(parseTeamQueueQuery({ q: "x", sort: "name" }).query)),
    );
    expect(out).toContain('href="/approvals?status=ok&amp;sort=name"');
  });

  it("says so when nothing matches the filters, with a way to clear them and keep the order", async () => {
    reads.getTeamQueuePage.mockResolvedValue(pendingPage(0, 0));
    const out = await html(
      ApprovalsSection(
        props(parseTeamQueueQuery({ q: "zzz", status: "over", sort: "name" }).query),
      ),
    );
    expect(out).toContain("No pending requests match these filters.");
    expect(out).toContain('href="/approvals?sort=name"');
  });

  it("says so when the team has nothing pending", async () => {
    reads.getTeamQueuePage.mockResolvedValue(pendingPage(0, 0));
    expect(await html(ApprovalsSection(props()))).toContain("No pending requests from your team.");
  });

  it("a failed read is an alert with a way to retry the same address, logged, and never throws", async () => {
    reads.getTeamQueuePage.mockRejectedValue(new Error("db down"));
    const out = await html(
      ApprovalsSection(props(parseTeamQueueQuery({ q: "a", page: "2" }).query)),
    );
    expect(out).toContain('role="alert"');
    expect(out).toContain("Pending requests could not be loaded");
    expect(out).toContain("/approvals?q=a&amp;page=2");
    expect(warn).toHaveBeenCalled();
  });

  it("if only the filter choices cannot be read the list still works, without the leave type list", async () => {
    reads.getTeamQueuePage.mockResolvedValue(pendingPage(2));
    reads.getTeamChoices.mockRejectedValue(new Error("no"));
    const out = await html(ApprovalsSection(props()));
    expect(out).toContain("Pending requests (2)");
    expect(out).toContain("All types");
    expect(out).not.toContain("Vacation</option>");
    expect(warn).toHaveBeenCalled();
  });
});

describe("ApprovalsSection, decided view", () => {
  const decided = parseTeamQueueQuery({ view: "decided" }).query;

  it("reads the decided page for the session manager, with its own tiles and filters", async () => {
    reads.getTeamDecidedPage.mockResolvedValue(decidedPage(2, 30));
    const out = await html(ApprovalsSection(props(decided)));
    expect(reads.getTeamDecidedPage).toHaveBeenCalledWith(DB, { ...decided, managerId: "m1" });
    expect(reads.getTeamQueuePage).not.toHaveBeenCalled();
    expect(out).toContain("Decided requests (30)");
    expect(out).toContain("HR overrides");
    expect(out).toContain("Approved (HR override)"); // a status option
    expect(out).toContain("Rejection note: Team is short that week");
  });

  it("says so when nothing has been decided, or nothing matches", async () => {
    reads.getTeamDecidedPage.mockResolvedValue(decidedPage(0, 0));
    expect(await html(ApprovalsSection(props(decided)))).toContain(
      "Nothing has been decided for your team yet.",
    );
    const q = parseTeamQueueQuery({ view: "decided", status: "rejected" }).query;
    expect(await html(ApprovalsSection(props(q)))).toContain(
      "No decided requests match these filters.",
    );
  });

  it("a failed read is an alert that retries the decided view", async () => {
    reads.getTeamDecidedPage.mockRejectedValue(new Error("db down"));
    const out = await html(ApprovalsSection(props(decided)));
    expect(out).toContain("Decided requests could not be loaded");
    expect(out).toContain("/approvals?view=decided");
  });
});
