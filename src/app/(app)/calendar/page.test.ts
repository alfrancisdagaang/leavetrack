import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireRole: guards.requireRole }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ APP_TIMEZONE: "UTC" }) }));
vi.mock("./calendar-body", () => ({
  CalendarBody: ({ viewerId }: { viewerId: string }) =>
    createElement("p", null, `body viewer=${viewerId}`),
}));

const { default: CalendarPage } = await import("./page");

const render = async (params: Record<string, string> = {}) =>
  renderToStaticMarkup(await CalendarPage({ searchParams: Promise.resolve(params) }));

beforeEach(() => {
  vi.clearAllMocks();
  guards.requireRole.mockResolvedValue({ role: "hr_admin", user: { id: "h1", name: "Hana" } });
});

describe("CalendarPage (EPIC-7 TASK-043)", () => {
  it("AC3: is for HR admins only: the guard decides, before anything is read", async () => {
    await render();
    expect(guards.requireRole).toHaveBeenCalledWith("hr_admin");
  });

  it("AC3: a guard that redirects (a manager or an employee) stops the page", async () => {
    guards.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(render()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("has the h1 and the subtitle", async () => {
    const out = await render();
    expect(out).toMatch(/<h1[^>]*>Company Calendar<\/h1>/);
    expect(out).toContain("See how many people are out each day.");
  });

  it("reads as the signed-in HR admin (from the session, not the address)", async () => {
    expect(await render({ viewer: "someone-else" })).toContain("body viewer=h1");
  });

  it("passes the parsed address on, and names the values that were not valid", async () => {
    const out = await render({ month: "2999-99", team: "nope" });
    expect(out).toContain("were not valid and were ignored: month, team");
  });
});
