import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireRole: guards.requireRole }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ APP_TIMEZONE: "Asia/Manila" }) }));
vi.mock("./approvals-sections", () => ({
  ApprovalsSection: ({
    managerId,
    query,
    timeZone,
  }: {
    managerId: string;
    query: { view: string; q?: string; page: number; sort: string; per: number };
    timeZone: string;
  }) =>
    createElement(
      "p",
      null,
      `list for ${managerId} view=${query.view} q=${query.q ?? ""} page=${query.page} sort=${query.sort} per=${query.per} tz=${timeZone}`,
    ),
}));

const { default: ApprovalsPage } = await import("./page");
const render = async (params: Record<string, string> = {}) =>
  renderToStaticMarkup(await ApprovalsPage({ searchParams: Promise.resolve(params) }));

beforeEach(() => {
  guards.requireRole.mockResolvedValue({ role: "manager", user: { id: "m1", name: "Marco" } });
});

describe("ApprovalsPage", () => {
  it("is for managers only (EPIC-10), and reads for the session user's id", async () => {
    const out = await render();
    expect(guards.requireRole).toHaveBeenCalledWith("manager");
    expect(out).toContain("list for m1 view=pending");
  });

  it("a guard that redirects (an employee or HR) stops the page", async () => {
    guards.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(render()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("has the single h1, the Pending and Decided views as links (not My Team), and no width cap", async () => {
    const out = await render();
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*>Team Approvals<\/h1>/);
    expect(out).toMatch(/<nav[^>]*aria-label="Team approvals views"/);
    expect(out).toMatch(/aria-current="page"[^>]*>Pending<\/a>/);
    expect(out).toContain('href="/approvals?view=decided"');
    expect(out).not.toContain("My team");
    expect(out).not.toContain("max-w-5xl");
  });

  it("the decided view marks its tab and changes the description", async () => {
    const out = await render({ view: "decided" });
    expect(out).toContain("view=decided");
    expect(out).toMatch(/aria-current="page"[^>]*>Decided<\/a>/);
    expect(out).toContain("have been decided");
  });

  it("passes the whole parsed address and the time zone on", async () => {
    const out = await render({ q: "elena", page: "2", sort: "days", per: "50" });
    expect(out).toContain("q=elena page=2 sort=days per=50 tz=Asia/Manila");
  });

  it("names an address value that was not valid, and carries on", async () => {
    const out = await render({ sort: "email; drop table users", status: "x" });
    expect(out).toContain("were not valid and were ignored: status, sort");
    expect(out).toContain("sort=created");
  });
});
