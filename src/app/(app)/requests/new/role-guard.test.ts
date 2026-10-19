import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_USERS } from "@/lib/mock/users";
import type { Session } from "@/lib/auth/session";

/** EPIC-10 AC2: Request Leave and My Balance are for employees; anyone else lands on /dashboard. */
const getSession = vi.fn<() => Promise<Session | null>>();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({}) }));
vi.mock("@/lib/logger", () => {
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return { logger: { ...log, child: () => log } };
});

const { default: NewRequestPage } = await import("./page");
const { default: BalancePage } = await import("../../balance/page");

beforeEach(() => getSession.mockReset());

describe.each([
  ["Request Leave", NewRequestPage],
  ["My Balance", BalancePage],
])("%s page", (_name, Page) => {
  it("redirects a manager and an HR admin to /dashboard", async () => {
    for (const [role, user] of [
      ["manager", MOCK_USERS.manager],
      ["hr_admin", MOCK_USERS.hrAdmin],
    ] as const) {
      getSession.mockResolvedValue({ role, user });
      await expect(Page()).rejects.toThrow("REDIRECT:/dashboard");
    }
  });

  it("sends a signed-out visitor to /login", async () => {
    getSession.mockResolvedValue(null);
    await expect(Page()).rejects.toThrow("REDIRECT:/login");
  });

  it("renders for an employee (AC3)", async () => {
    getSession.mockResolvedValue({ role: "employee", user: MOCK_USERS.employee });
    await expect(Page()).resolves.toBeTruthy();
  });
});
