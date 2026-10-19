import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireRole: guards.requireRole }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ APP_TIMEZONE: "UTC" }) }));
vi.mock("./roster-section", () => ({
  RosterSection: ({ managerId, today }: { managerId: string; today: string }) =>
    createElement("p", null, `roster for ${managerId} on ${today.length} chars`),
}));
vi.mock("./member-popup", () => ({
  MemberPopup: ({ managerId, memberParam }: { managerId: string; memberParam: string }) =>
    createElement("p", null, `popup for ${memberParam} by ${managerId}`),
}));

const { default: TeamPage } = await import("./page");

const render = async (searchParams: Record<string, string | string[] | undefined> = {}) =>
  renderToStaticMarkup(await TeamPage({ searchParams: Promise.resolve(searchParams) }));

beforeEach(() => {
  vi.clearAllMocks();
  guards.requireRole.mockResolvedValue({ role: "manager", user: { id: "m1", name: "Marco" } });
});

describe("TeamPage (US-12)", () => {
  it("AC4: is for managers only (EPIC-10): an employee or HR admin is sent away by the guard", async () => {
    await render();
    expect(guards.requireRole).toHaveBeenCalledWith("manager");
  });

  it("AC4: a guard that redirects (an employee) stops the page: nothing is read or rendered", async () => {
    guards.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(render({ member: "x" })).rejects.toThrow("NEXT_REDIRECT");
  });

  it("reads for the signed-in user's id, never a client value", async () => {
    const out = await render();
    expect(out).toContain("roster for m1 on 10 chars"); // today is an ISO date
  });

  it("shows the page title and subtitle, and does not cap its width (it fills the area like the dashboard)", async () => {
    const out = await render();
    expect(out).toMatch(/<h1[^>]*>My Team<\/h1>/);
    expect(out).toContain("Your direct reports and their leave at a glance.");
    expect(out).not.toContain("max-w-5xl");
  });

  it("has no tabs: Team Approvals and My Team are separate nav items", async () => {
    const out = await render();
    expect(out).not.toContain("Team approvals sections");
  });

  it("opens no popup without a member in the address", async () => {
    expect(await render()).not.toContain("popup for");
    expect(await render({ member: "" })).not.toContain("popup for");
  });

  it("opens the popup for the member in the address, scoped to the session user", async () => {
    const out = await render({ member: "abc" });
    expect(out).toContain("popup for abc by m1");
    expect(out).toContain("roster for m1");
  });

  it("uses the first value when the address repeats member", async () => {
    expect(await render({ member: ["one", "two"] })).toContain("popup for one by m1");
  });
});
