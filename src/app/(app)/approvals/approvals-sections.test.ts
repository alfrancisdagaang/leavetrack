import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const team = vi.hoisted(() => ({ getTeamQueue: vi.fn(), getRecentlyDecided: vi.fn() }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: () => {},
  useRouter: () => ({ refresh: () => {} }),
}));
vi.mock("@/lib/db/timed", () => ({ timedRead: (_n: string, fn: () => unknown) => fn() }));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => ({}) }));
vi.mock("@/lib/leave/team", () => team);
vi.mock("@/lib/logger", () => ({ logger: { warn: () => {} } }));

const { PendingSection, DecidedSection } = await import("./approvals-sections");
const html = async (p: Promise<ReactElement | null>) => {
  const el = await p;
  return el ? renderToStaticMarkup(el) : "";
};

beforeEach(() => vi.clearAllMocks());

describe("PendingSection", () => {
  it("passes the session manager id to the scoped query and shows the count", async () => {
    team.getTeamQueue.mockResolvedValue([]);
    const out = await html(PendingSection({ managerId: "m1" }));
    expect(team.getTeamQueue).toHaveBeenCalledWith({}, "m1");
    expect(out).toContain("Pending requests");
    expect(out).toContain("0 pending");
    expect(out).toContain("No pending requests from your team.");
  });

  it("a failed read shows an alert with a retry, not an error page", async () => {
    team.getTeamQueue.mockRejectedValue(new Error("boom"));
    const out = await html(PendingSection({ managerId: "m1" }));
    expect(out).toContain('role="alert"');
    expect(out).toContain("could not be loaded");
    expect(out).toContain('href="/approvals"');
  });
});

describe("DecidedSection", () => {
  it("renders nothing when there are no decisions", async () => {
    team.getRecentlyDecided.mockResolvedValue([]);
    expect(await html(DecidedSection({ managerId: "m1" }))).toBe("");
  });

  it("a failed read degrades to a note", async () => {
    team.getRecentlyDecided.mockRejectedValue(new Error("boom"));
    expect(await html(DecidedSection({ managerId: "m1" }))).toContain("could not be loaded");
  });
});
