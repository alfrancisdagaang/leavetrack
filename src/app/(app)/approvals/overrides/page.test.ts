import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireRole: guards.requireRole }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ APP_TIMEZONE: "Asia/Manila" }) }));
vi.mock("./override-sections", () => ({
  OverridesSection: ({
    hrId,
    query,
    timeZone,
  }: {
    hrId: string;
    query: { view: string; team?: string; page: number; sort: string };
    timeZone: string;
  }) =>
    createElement(
      "p",
      null,
      `list for ${hrId} view=${query.view} team=${query.team ?? ""} page=${query.page} sort=${query.sort} tz=${timeZone}`,
    ),
}));

const { default: OverridesPage } = await import("./page");
const render = async (params: Record<string, string> = {}) =>
  renderToStaticMarkup(await OverridesPage({ searchParams: Promise.resolve(params) }));

beforeEach(() => {
  guards.requireRole.mockReset();
  guards.requireRole.mockResolvedValue({ role: "hr_admin", user: { id: "h1", name: "Hana" } });
});

describe("OverridesPage", () => {
  it("AC3: is for HR Admins only, and reads for the session user's id", async () => {
    const out = await render();
    expect(guards.requireRole).toHaveBeenCalledWith("hr_admin");
    expect(out).toContain("list for h1 view=waiting");
    expect(out).toContain("tz=Asia/Manila");
  });

  it("AC3: a manager or employee never gets the page (requireRole redirects before any section)", async () => {
    guards.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(render()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("has the single h1, the Waiting and Overridden views as links, and no width cap", async () => {
    const out = await render();
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*>Balance Overrides<\/h1>/);
    expect(out).toMatch(/<nav[^>]*aria-label="Balance overrides views"/);
    expect(out).toMatch(/aria-current="page"[^>]*>Waiting<\/a>/);
    expect(out).toContain('href="/approvals/overrides?view=overridden"');
    expect(out).not.toContain("max-w-5xl");
  });

  it("the overridden view marks its tab and changes the description", async () => {
    const out = await render({ view: "overridden" });
    expect(out).toMatch(/aria-current="page"[^>]*>Overridden<\/a>/);
    expect(out).toContain("view=overridden");
    expect(out).toContain("approved over the balance");
  });

  it("passes the parsed address on, and names a value that was not valid", async () => {
    const team = "00000000-0000-4000-8000-000000000002";
    expect(await render({ team, page: "3", sort: "shortfall" })).toContain(
      `team=${team} page=3 sort=shortfall`,
    );
    const bad = await render({ team: "x", sort: "balance" });
    expect(bad).toContain("were not valid and were ignored: sort, team");
  });
});
