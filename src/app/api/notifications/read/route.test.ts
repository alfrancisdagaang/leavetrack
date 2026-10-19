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

const markNotificationsRead = vi.fn();
const FAKE_SQL = { fake: true };
vi.mock("@/lib/leave/notifications", () => ({
  markNotificationsRead: (...args: unknown[]) => markNotificationsRead(...args),
}));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => FAKE_SQL }));

const { POST } = await import("@/app/api/notifications/read/route");

const N1 = "40000000-0000-4000-8000-000000000001";

function post(body?: string) {
  return POST(
    new Request("http://localhost/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
    {},
  );
}

const asEmployee = () =>
  getSession.mockResolvedValue({ role: "employee", user: MOCK_USERS.employee });

beforeEach(() => {
  getSession.mockReset();
  markNotificationsRead.mockReset();
  markNotificationsRead.mockResolvedValue({ marked: 2, unread: 0 });
});

describe("POST /api/notifications/read (TASK-054)", () => {
  it("AC3: returns 401 in the standard envelope without a session, and writes nothing", async () => {
    getSession.mockResolvedValue(null);
    const res = await post("{}");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    expect(markNotificationsRead).not.toHaveBeenCalled();
  });

  it("an empty body, and an empty object, mean mark all, for the session user", async () => {
    asEmployee();
    for (const body of [undefined, "", "   ", "{}"]) {
      markNotificationsRead.mockClear();
      const res = await post(body);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true, data: { marked: 2, unread: 0 } });
      expect(markNotificationsRead).toHaveBeenCalledWith(
        FAKE_SQL,
        MOCK_USERS.employee.id,
        undefined,
      );
    }
  });

  it.each([
    ["employee", MOCK_USERS.employee],
    ["manager", MOCK_USERS.manager],
    ["hr_admin", MOCK_USERS.hrAdmin],
  ] as const)("AC2: a %s marks one notification, as themselves", async (role, user) => {
    getSession.mockResolvedValue({ role, user });
    expect((await post(JSON.stringify({ id: N1 }))).status).toBe(200);
    expect(markNotificationsRead).toHaveBeenCalledWith(FAKE_SQL, user.id, N1);
  });

  it("AC2: a client-sent user id in the body is ignored", async () => {
    asEmployee();
    await post(JSON.stringify({ id: N1, user_id: MOCK_USERS.manager.id, recipient_id: "x" }));
    expect(markNotificationsRead).toHaveBeenCalledWith(FAKE_SQL, MOCK_USERS.employee.id, N1);
  });

  it("a bad id is a 400 VALIDATION_ERROR and writes nothing", async () => {
    asEmployee();
    const res = await post(JSON.stringify({ id: "1; drop table" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(markNotificationsRead).not.toHaveBeenCalled();
  });

  it("invalid JSON, and a body that is not an object, are 400 VALIDATION_ERROR", async () => {
    asEmployee();
    for (const body of ["{not json", "[]", "5", '"x"']) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        success: false,
        error: { code: "VALIDATION_ERROR" },
      });
    }
    expect(markNotificationsRead).not.toHaveBeenCalled();
  });

  it("a foreign id looks exactly like any other no-op: 200 with marked 0", async () => {
    asEmployee();
    markNotificationsRead.mockResolvedValue({ marked: 0, unread: 3 });
    const res = await post(JSON.stringify({ id: N1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { marked: 0, unread: 3 } });
  });
});
