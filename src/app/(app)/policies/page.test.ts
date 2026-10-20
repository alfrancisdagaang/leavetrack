import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireRole: guards.requireRole }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ APP_TIMEZONE: "Asia/Manila" }) }));
vi.mock("./policies-sections", () => ({
  PolicyListSection: ({
    viewerId,
    query,
    timeZone,
  }: {
    viewerId: string;
    query: { q?: string; page: number; sort: string; per: number };
    timeZone: string;
  }) =>
    createElement(
      "p",
      null,
      `list viewer=${viewerId} q=${query.q ?? ""} page=${query.page} sort=${query.sort} per=${query.per} tz=${timeZone}`,
    ),
  RecentChangesSection: ({ viewerId, timeZone }: { viewerId: string; timeZone: string }) =>
    createElement("p", null, `recent viewer=${viewerId} tz=${timeZone}`),
}));

const { default: PoliciesPage } = await import("./page");
const render = async (params: Record<string, string> = {}) =>
  renderToStaticMarkup(await PoliciesPage({ searchParams: Promise.resolve(params) }));

beforeEach(() => {
  vi.clearAllMocks();
  guards.requireRole.mockResolvedValue({ role: "hr_admin", user: { id: "h1", name: "Hana" } });
});

describe("PoliciesPage (EPIC-13 TASK-072)", () => {
  it("AC3: is for HR admins only: the guard decides, before anything is read", async () => {
    await render();
    expect(guards.requireRole).toHaveBeenCalledWith("hr_admin");
  });

  it("AC3: a guard that redirects (an employee or a manager) stops the page", async () => {
    guards.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(render()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("has the single h1 and says when a new rate applies", async () => {
    const out = await render();
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toMatch(/<h1[^>]*>Leave Policies<\/h1>/);
    expect(out).toContain("applies from the next monthly accrual");
  });

  it("reads for the SESSION user, with the time zone, and passes the whole parsed address on", async () => {
    const out = await render({ q: "elena", page: "2", sort: "sick", per: "50" });
    expect(out).toContain("list viewer=h1 q=elena page=2 sort=sick per=50 tz=Asia/Manila");
    expect(out).toContain("recent viewer=h1 tz=Asia/Manila");
  });

  it("puts the recent changes in a labelled aside beside the list from 1700px, and under it below", async () => {
    const out = await render();
    expect(out).toContain("min-[1700px]:grid-cols-[minmax(0,1fr)_20rem]");
    expect(out).toMatch(/<aside[^>]*aria-label="Recent changes"/);
  });

  it("names an address value that was not valid, and carries on", async () => {
    const out = await render({ page: "0" });
    expect(out).toContain("were not valid and were ignored: page");
    expect(out).toContain("page=1");
    const sort = await render({ sort: "email; drop table users" });
    expect(sort).toContain("were not valid and were ignored: sort");
    expect(sort).toContain("sort=name");
  });
});
