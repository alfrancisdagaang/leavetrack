import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guards = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireRole: guards.requireRole }));
vi.mock("./audit-body", () => ({
  AuditBody: ({ query }: { query: { q?: string; page: number } }) =>
    createElement("p", null, `body q=${query.q ?? ""} page=${query.page}`),
}));

const { default: AuditPage } = await import("./page");

const render = async (params: Record<string, string> = {}) =>
  renderToStaticMarkup(await AuditPage({ searchParams: Promise.resolve(params) }));

beforeEach(() => {
  vi.clearAllMocks();
  guards.requireRole.mockResolvedValue({ role: "hr_admin", user: { id: "h1", name: "Hana" } });
});

describe("AuditPage (US-14)", () => {
  it("AC1: is for HR admins only: the guard decides, before anything is read", async () => {
    await render();
    expect(guards.requireRole).toHaveBeenCalledWith("hr_admin");
  });

  it("AC1: a guard that redirects (a manager or an employee) stops the page", async () => {
    guards.requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(render()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("AC10: has the h1 and the subtitle, and does not cap its width", async () => {
    const out = await render();
    expect(out).toMatch(/<h1[^>]*>Audit History<\/h1>/);
    expect(out).toContain("View the full history of leave requests, decisions, and actions.");
    expect(out).not.toContain("max-w-5xl");
  });

  it("passes the parsed address filters on, and names the ones that were not valid", async () => {
    const out = await render({ q: "elena", page: "2", status: "cancelled" });
    expect(out).toContain("body q=elena page=2");
    expect(out).toContain("were not valid and were ignored: status");
  });
});
