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

const { default: TeamPage } = await import("./page");

beforeEach(() => {
  vi.clearAllMocks();
  guards.requireRole.mockResolvedValue({ role: "manager", user: { id: "m1", name: "Marco" } });
});

describe("TeamPage (US-12)", () => {
  it("AC4: is for managers only (EPIC-10): an employee or HR admin is sent away by the guard", async () => {
    await TeamPage();
    expect(guards.requireRole).toHaveBeenCalledWith("manager");
  });

  it("AC4: a guard that redirects (an employee) stops the page: nothing is read or rendered", async () => {
    guards.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(TeamPage()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("reads for the signed-in user's id, never a client value", async () => {
    const out = renderToStaticMarkup(await TeamPage());
    expect(out).toContain("roster for m1 on 10 chars"); // today is an ISO date
  });

  it("shows the page title and subtitle, and does not cap its width (it fills the area like the dashboard)", async () => {
    const out = renderToStaticMarkup(await TeamPage());
    expect(out).toMatch(/<h1[^>]*>Team approvals<\/h1>/);
    expect(out).toContain("Your direct reports and their leave at a glance.");
    expect(out).not.toContain("max-w-5xl");
  });

  it("shows the two tabs with My team as the current one", async () => {
    const out = renderToStaticMarkup(await TeamPage());
    expect(out).toContain('aria-label="Team approvals sections"');
    expect(out).toMatch(
      /<a(?=[^>]*aria-current="page")(?=[^>]*href="\/approvals\/team")[^>]*>My team<\/a>/,
    );
    expect(out).toMatch(/<a(?=[^>]*href="\/approvals")(?![^>]*aria-current)[^>]*>Approvals<\/a>/);
  });
});
