import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/auth/session";
import { MOCK_USERS } from "@/lib/mock/users";

vi.mock("@/lib/logger", () => {
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return { logger: { ...log, child: () => log } };
});

const getSession = vi.fn<() => Promise<Session | null>>();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const listNotifications = vi.fn();
const FAKE_SQL = { fake: true };
vi.mock("@/lib/leave/notifications", () => ({
  listNotifications: (...args: unknown[]) => listNotifications(...args),
}));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => FAKE_SQL }));

const { GET } = await import("@/app/api/notifications/route");

const LIST = { unread: 1, notifications: [{ id: "n1" }] };
const get = (query = "") => GET(new Request(`http://localhost/api/notifications${query}`), {});

beforeEach(() => {
  getSession.mockReset();
  listNotifications.mockReset();
  listNotifications.mockResolvedValue(LIST);
});

describe("GET /api/notifications (TASK-054)", () => {
  it("AC3: returns 401 in the standard envelope without a session, and reads nothing", async () => {
    getSession.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    expect(listNotifications).not.toHaveBeenCalled();
  });

  it.each([
    ["employee", MOCK_USERS.employee],
    ["manager", MOCK_USERS.manager],
    ["hr_admin", MOCK_USERS.hrAdmin],
  ] as const)(
    "AC1: a %s gets their own list, read for the SESSION user's id",
    async (role, user) => {
      getSession.mockResolvedValue({ role, user });
      const res = await get();
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, data: LIST });
      expect(listNotifications).toHaveBeenCalledWith(FAKE_SQL, user.id);
    },
  );

  it("AC1: a client-sent user id in the query is ignored", async () => {
    getSession.mockResolvedValue({ role: "manager", user: MOCK_USERS.manager });
    await get(`?user_id=${MOCK_USERS.employee.id}&recipient_id=${MOCK_USERS.employee.id}`);
    expect(listNotifications).toHaveBeenCalledTimes(1);
    expect(listNotifications).toHaveBeenCalledWith(FAKE_SQL, MOCK_USERS.manager.id);
  });

  it("is never cached: the data is per person", async () => {
    getSession.mockResolvedValue({ role: "employee", user: MOCK_USERS.employee });
    expect((await get()).headers.get("cache-control")).toBe("no-store");
  });

  it("a failure reads as the standard envelope and leaks no detail", async () => {
    getSession.mockResolvedValue({ role: "employee", user: MOCK_USERS.employee });
    listNotifications.mockRejectedValue(new Error("password authentication failed for user x"));
    const res = await get();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "INTERNAL", message: "An unexpected error occurred." },
    });
  });
});
