import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireRole: guards.requireRole }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ APP_TIMEZONE: "Asia/Manila" }) }));
vi.mock("./override-sections", () => ({
  OverrideQueueSection: ({ hrId }: { hrId: string }) =>
    createElement("p", null, `queue for ${hrId}`),
  RecentOverridesSection: ({ timeZone }: { timeZone: string }) =>
    createElement("p", null, `recent in ${timeZone}`),
}));

const { default: OverridesPage } = await import("./page");

beforeEach(() => {
  guards.requireRole.mockReset();
  guards.requireRole.mockResolvedValue({ role: "hr_admin", user: { id: "h1", name: "Hana" } });
});

describe("OverridesPage", () => {
  it("AC3: is for HR Admins only, and reads for the session user's id", async () => {
    const out = renderToStaticMarkup(await OverridesPage());
    expect(guards.requireRole).toHaveBeenCalledWith("hr_admin");
    expect(out).toContain("queue for h1");
    expect(out).toContain("recent in Asia/Manila");
  });

  it("AC3: a manager or employee never gets the page (requireRole redirects before any section)", async () => {
    guards.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(OverridesPage()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("has the single h1 and no width cap", async () => {
    const out = renderToStaticMarkup(await OverridesPage());
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*>HR overrides<\/h1>/);
    expect(out).not.toContain("max-w-5xl");
  });
});
