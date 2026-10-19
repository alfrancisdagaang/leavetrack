import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireRole: guards.requireRole }));
vi.mock("./approvals-sections", () => ({
  PendingSection: ({ managerId }: { managerId: string }) =>
    createElement("p", null, `pending for ${managerId}`),
  DecidedSection: ({ managerId }: { managerId: string }) =>
    createElement("p", null, `decided for ${managerId}`),
}));

const { default: ApprovalsPage } = await import("./page");

beforeEach(() => {
  guards.requireRole.mockResolvedValue({ role: "manager", user: { id: "m1", name: "Marco" } });
});

describe("ApprovalsPage", () => {
  it("is for managers only (EPIC-10), and reads for the session user's id", async () => {
    const out = renderToStaticMarkup(await ApprovalsPage());
    expect(guards.requireRole).toHaveBeenCalledWith("manager");
    expect(out).toContain("pending for m1");
    expect(out).toContain("decided for m1");
  });

  it("has the h1, no tabs (My Team is its own nav item), and no width cap", async () => {
    const out = renderToStaticMarkup(await ApprovalsPage());
    expect(out).toMatch(/<h1[^>]*>Team Approvals<\/h1>/);
    expect(out).not.toContain("Team approvals sections");
    expect(out).not.toContain("My team");
    expect(out).not.toContain("max-w-5xl");
  });
});
