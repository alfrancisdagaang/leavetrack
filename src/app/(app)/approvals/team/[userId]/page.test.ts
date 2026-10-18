import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TeamMemberPage } from "@/lib/leave/team-member";

const ID = "00000000-0000-4000-8000-000000000003";
const VAC = "10000000-0000-4000-8000-000000000001";
const NOT_FOUND = "NEXT_NOT_FOUND";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getTeamMemberPage: vi.fn(),
  notFound: vi.fn(),
}));
vi.mock("@/lib/auth/guards", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ APP_TIMEZONE: "UTC" }) }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => ({}) }));
vi.mock("@/lib/leave/team-member", () => ({ getTeamMemberPage: mocks.getTeamMemberPage }));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  // Next's own control-flow errors must pass through a catch block.
  unstable_rethrow: (err: unknown) => {
    if (err instanceof Error && err.message === NOT_FOUND) throw err;
  },
  useRouter: () => ({ refresh: () => {} }),
}));

const { default: TeamMemberRoute } = await import("./page");

const currentYear = new Date().getUTCFullYear();
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
      startDate: `${currentYear}-03-02`,
      endDate: `${currentYear}-03-04`,
      workingDays: 3,
      status: "approved",
      decisionNote: null,
      reason: null,
      insufficient: false,
    },
  ],
  total: 1,
  ...over,
});
const render = async (userId = ID, search: Record<string, string> = {}) =>
  renderToStaticMarkup(
    await TeamMemberRoute({
      params: Promise.resolve({ userId }),
      searchParams: Promise.resolve(search),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireRole.mockResolvedValue({ role: "manager", user: { id: "m1", name: "Marco" } });
  mocks.getTeamMemberPage.mockResolvedValue(data());
  mocks.notFound.mockImplementation(() => {
    throw new Error(NOT_FOUND);
  });
});

describe("TeamMemberRoute: access (US-12 AC4, US-13 AC7)", () => {
  it("is for managers and HR admins only", async () => {
    await render();
    expect(mocks.requireRole).toHaveBeenCalledWith("manager", "hr_admin");
  });

  it("a guard that redirects (an employee) stops the page before anything is read", async () => {
    mocks.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(render()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.getTeamMemberPage).not.toHaveBeenCalled();
  });

  it("a malformed address is 'not found' and never reaches the database", async () => {
    for (const bad of ["abc", "1", "../admin", "00000000-0000-4000-8000-00000000000z"]) {
      await expect(render(bad)).rejects.toThrow(NOT_FOUND);
    }
    expect(mocks.getTeamMemberPage).not.toHaveBeenCalled();
  });

  it("another team's member, a missing person and a deleted one all end the same way (the read gives null)", async () => {
    mocks.getTeamMemberPage.mockResolvedValue(null);
    const outcomes: string[] = [];
    for (const id of [
      ID,
      "00000000-0000-4000-8000-000000000006",
      "10000000-0000-4000-8000-0000000000ff",
    ]) {
      try {
        await render(id);
        outcomes.push("rendered");
      } catch (err) {
        outcomes.push((err as Error).message);
      }
    }
    expect(outcomes).toEqual([NOT_FOUND, NOT_FOUND, NOT_FOUND]);
  });

  it("reads with the signed-in user's id and the person and filters from the address, nothing else", async () => {
    await render(ID, { status: "pending", year: String(currentYear - 1), page: "2" });
    expect(mocks.getTeamMemberPage).toHaveBeenCalledWith({}, "m1", ID, {
      leaveTypeId: undefined,
      status: "pending",
      year: currentYear - 1,
      page: 2,
    });
  });
});

describe("TeamMemberRoute: the page (US-13 AC1, AC2, AC3, AC6, AC8)", () => {
  it("shows the person, their balances, the filters and their requests", async () => {
    const out = await render();
    expect(out).toMatch(/<h1[^>]*>Elena Cruz<\/h1>/);
    expect(out).toContain("Available after pending");
    expect(out).toContain('aria-label="Filter requests"');
    expect(out).toMatch(/<h2[^>]*>1 request<\/h2>/); // the count is the results' heading
    expect(out).toContain("1 request<");
  });

  it("does not cap its width (it fills the area like the dashboard)", async () => {
    expect(await render()).not.toContain("max-w-5xl");
  });

  it("AC3: a bad filter value is ignored with a note, and the page still reads and renders", async () => {
    const out = await render(ID, { year: "1999", status: "deleted" });
    expect(out).toContain("were not valid and were ignored: status, year.");
    expect(mocks.getTeamMemberPage).toHaveBeenCalled();
  });

  it("no note when every value is valid", async () => {
    expect(await render(ID, { status: "approved" })).not.toContain("were ignored");
  });

  it("AC6: shows the pagination when there is more than one page, keeping the filters", async () => {
    mocks.getTeamMemberPage.mockResolvedValue(data({ total: 31 }));
    const out = await render(ID, { status: "approved" });
    expect(out).toContain("Showing 1 to 25 of 31");
    expect(out).toContain(`href="/approvals/team/${ID}?status=approved&amp;page=2"`);
  });

  it("AC2: says nothing matches when the filters match nothing, with a way to clear them", async () => {
    mocks.getTeamMemberPage.mockResolvedValue(data({ requests: [], total: 0 }));
    const out = await render(ID, { status: "rejected" });
    expect(out).toContain("No requests match these filters.");
    expect(out).toContain("Clear filters");
  });

  it("says so when the page is past the last one", async () => {
    mocks.getTeamMemberPage.mockResolvedValue(data({ requests: [], total: 31 }));
    const out = await render(ID, { page: "9" });
    expect(out).toContain("There are no requests on this page.");
    expect(out).toContain("Go to the first page");
  });

  it("AC8: says so, with a way to retry, when the read fails (never a crash, never 'not found')", async () => {
    mocks.getTeamMemberPage.mockRejectedValue(new Error("boom"));
    const out = await render(ID, { page: "2" });
    expect(out).toContain('role="alert"');
    expect(out).toContain("could not be loaded right now.");
    expect(out).toContain(`href="/approvals/team/${ID}?page=2"`);
    expect(out).toMatch(/<a [^>]*href="\/approvals\/team"[^>]*>[\s\S]*Back to My team<\/a>/); // never a dead end
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
