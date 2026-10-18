import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RosterMember } from "@/lib/leave/team-roster";

const roster = vi.hoisted(() => ({ getTeamRoster: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => ({}) }));
vi.mock("@/lib/leave/team-roster", () => ({ getTeamRoster: roster.getTeamRoster }));

const { RosterSection } = await import("./roster-section");

const member = (id: string, name: string): RosterMember => ({
  id,
  name,
  role: "employee",
  status: { kind: "none" },
  pendingCount: 0,
  balances: [],
  lastRequest: null,
});
const render = async () =>
  renderToStaticMarkup(await RosterSection({ managerId: "m1", today: "2026-10-18" }));

beforeEach(() => vi.clearAllMocks());

describe("RosterSection", () => {
  it("lists the people the read returned, in that order", async () => {
    roster.getTeamRoster.mockResolvedValue([
      member("a", "Elena Cruz"),
      member("b", "Jun Bautista"),
    ]);
    const out = await render();
    expect(out).toContain('aria-label="Your direct reports"');
    expect(out.indexOf("Elena Cruz")).toBeLessThan(out.indexOf("Jun Bautista"));
  });

  it("reads only for the signed-in manager's id and the server's today, never a client value", async () => {
    roster.getTeamRoster.mockResolvedValue([]);
    await render();
    expect(roster.getTeamRoster).toHaveBeenCalledWith({}, "m1", "2026-10-18");
  });

  it("AC3: shows the empty state, not an error, when there are no reports", async () => {
    roster.getTeamRoster.mockResolvedValue([]);
    const out = await render();
    expect(out).toContain("You have no direct reports yet.");
    expect(out).not.toContain('role="alert"');
  });

  it("AC5: says so, with a way to retry, when the roster cannot be read", async () => {
    roster.getTeamRoster.mockRejectedValue(new Error("boom"));
    const out = await render();
    expect(out).toContain('role="alert"');
    expect(out).toContain("Your team could not be loaded right now.");
    expect(out).toContain('href="/approvals/team"');
  });
});
