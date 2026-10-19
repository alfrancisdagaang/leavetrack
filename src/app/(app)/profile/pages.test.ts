import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as OrgModule from "@/lib/leave/org";

const guard = vi.hoisted(() => ({ requireSession: vi.fn() }));
vi.mock("@/lib/auth/guards", () => ({ requireSession: guard.requireSession }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => ({}) }));
vi.mock("@/lib/leave/profile", () => ({ getProfile: async () => null }));
vi.mock("@/lib/leave/org", async (importOriginal) => ({
  ...(await importOriginal<typeof OrgModule>()),
  getEmployeeOrg: async () => null,
  getManagerOrg: async () => null,
  getOrgRoots: async () => null,
}));

const { default: ProfilePage } = await import("./page");
const { default: OrganizationPage } = await import("./organization/page");
const { default: SettingsPage } = await import("./settings/page");

const PAGES = [
  ["Overview", ProfilePage],
  ["Organization", OrganizationPage],
  ["Account settings", SettingsPage],
] as const;

beforeEach(() => {
  guard.requireSession.mockReset();
  guard.requireSession.mockResolvedValue({
    role: "employee",
    user: { id: "u1", name: "Elena Cruz" },
  });
});

describe.each(PAGES)("the %s page (TASK-062)", (tab, Page) => {
  it("requires a session first: with none, the visitor is sent away and nothing renders (AC4)", async () => {
    guard.requireSession.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("has the single h1 'My Profile' and the tab strip with this tab current", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("My Profile");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`aria-current="page"[^>]*>${tab}</a>`));
  });
});
