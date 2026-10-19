import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamMemberPage } from "@/lib/leave/team-member";

const ID = "00000000-0000-4000-8000-000000000003";
const VAC = "10000000-0000-4000-8000-000000000001";

const mocks = vi.hoisted(() => ({ getTeamMemberPage: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/db/timed", () => ({ timedRead: (_n: string, fn: () => unknown) => fn() }));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => ({}) }));
vi.mock("@/lib/leave/team-member", () => ({ getTeamMemberPage: mocks.getTeamMemberPage }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: () => {},
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const { MemberPopup } = await import("./member-popup");

const data = (over: Partial<TeamMemberPage> = {}): TeamMemberPage => ({
  member: { id: ID, name: "Elena Cruz", role: "employee" },
  balances: [
    {
      leaveTypeId: VAC,
      leaveTypeName: "Vacation",
      tracksBalance: true,
      confirmed: 10,
      pending: 2,
      available: 8,
    },
  ],
  leaveTypes: [{ id: VAC, name: "Vacation" }],
  requests: [
    {
      id: "r1",
      leaveTypeId: VAC,
      leaveTypeName: "Vacation",
      startDate: "2026-03-02",
      endDate: "2026-03-04",
      workingDays: 3,
      status: "approved",
      decisionNote: null,
      reason: null,
      balanceCheck: { kind: "ok" },
      overridden: false,
    },
  ],
  total: 1,
  ...over,
});

const render = async (memberParam = ID, searchParams: Record<string, string> = {}) =>
  renderToStaticMarkup(
    await MemberPopup({
      managerId: "m1",
      memberParam,
      searchParams: { member: memberParam, ...searchParams },
      today: "2026-10-19",
    }),
  );

const NOT_FOUND = "We couldn&#x27;t find that person on your team.";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTeamMemberPage.mockResolvedValue(data());
});

describe("MemberPopup", () => {
  it("shows the person, the filters and their requests, and no balances, in a dialog named by the person", async () => {
    const out = await render();
    expect(out).toMatch(/<dialog[^>]* open=""/);
    expect(out).toMatch(/<h2 id="member-dialog-heading"[^>]*>Elena Cruz<\/h2>/);
    expect(out).toContain("Employee");
    expect(out).not.toContain("Available after pending");
    expect(out).not.toContain("Confirmed 10");
    expect(out).toContain('aria-label="Filter requests"');
    expect(out).toContain("1 request<");
  });

  it("reads with the signed-in manager's id, the person from the address and the filters from it", async () => {
    await render(ID, { status: "pending", page: "2", year: "2025" });
    expect(mocks.getTeamMemberPage).toHaveBeenCalledWith({}, "m1", ID, {
      leaveTypeId: undefined,
      status: "pending",
      year: 2025,
      page: 2,
    });
  });

  it("a malformed id is the same 'not found' message and never reaches the database", async () => {
    for (const bad of ["abc", "1", "../admin", "00000000-0000-4000-8000-00000000000z"]) {
      const out = await render(bad);
      expect(out).toContain(NOT_FOUND);
    }
    expect(mocks.getTeamMemberPage).not.toHaveBeenCalled();
  });

  it("another team's member, a missing or a deleted person all show the same message (the read gives null)", async () => {
    mocks.getTeamMemberPage.mockResolvedValue(null);
    const outs = [
      await render(ID),
      await render("00000000-0000-4000-8000-000000000006"),
      await render("10000000-0000-4000-8000-0000000000ff"),
    ];
    for (const out of outs) {
      expect(out).toContain(NOT_FOUND);
      expect(out).toContain('id="member-dialog-heading"');
    }
    // The message does not depend on which id was asked for.
    expect(new Set(outs).size).toBe(1);
  });

  it("a failed read says so in an alert with a retry that keeps the person open", async () => {
    mocks.getTeamMemberPage.mockRejectedValue(new Error("boom"));
    const out = await render(ID, { status: "pending" });
    expect(out).toContain('role="alert"');
    expect(out).toContain("could not be loaded");
    expect(out).toContain(`href="/approvals/team?member=${ID}&amp;status=pending"`);
    expect(out).toContain('id="member-dialog-heading"');
  });

  it("every link inside keeps the popup open: pagination, filters and clear all carry ?member=", async () => {
    mocks.getTeamMemberPage.mockResolvedValue(data({ total: 60 }));
    const out = await render(ID, { status: "approved" });
    expect(out).toContain(`href="/approvals/team?member=${ID}&amp;status=approved&amp;page=2"`);
    expect(out).toContain(`href="/approvals/team?member=${ID}"`); // Clear filters
    expect(out).toContain('action="/approvals/team"');
    expect(out).toContain(`<input type="hidden" name="member" value="${ID}"/>`);
    expect(out).not.toContain(`/approvals/team/${ID}`);
  });

  it("a filter with no matches clears back to the popup, not the member page", async () => {
    mocks.getTeamMemberPage.mockResolvedValue(data({ requests: [], total: 0 }));
    const out = await render(ID, { status: "rejected" });
    expect(out).toContain("No requests match these filters.");
    expect(out).toContain(`href="/approvals/team?member=${ID}"`);
    expect(out).not.toContain(`/approvals/team/${ID}`);
  });

  it("names invalid filters in the address and ignores them", async () => {
    const out = await render(ID, { status: "deleted" });
    expect(out).toContain("were not valid and were ignored: status");
  });

  it("has a Close link back to the plain My Team page", async () => {
    const out = await render();
    expect(out).toMatch(
      /<a [^>]*href="\/approvals\/team"[^>]*aria-label="Close"|aria-label="Close"[^>]*href="\/approvals\/team"/,
    );
  });
});
