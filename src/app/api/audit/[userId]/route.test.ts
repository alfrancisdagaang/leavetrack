import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/auth/session";
import { AppError } from "@/lib/errors/app-error";
import { MOCK_USERS } from "@/lib/mock/users";

vi.mock("@/lib/logger", () => {
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return { logger: { ...log, child: () => log } };
});

const getSession = vi.fn<() => Promise<Session | null>>();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const getAuditHistory = vi.fn();
const FAKE_SQL = { fake: true };
vi.mock("@/lib/leave/audit", () => ({
  getAuditHistory: (...args: unknown[]) => getAuditHistory(...args),
}));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => FAKE_SQL }));

const { GET } = await import("@/app/api/audit/[userId]/route");

const ELENA = "00000000-0000-4000-8000-000000000003";
const LEO = "00000000-0000-4000-8000-000000000006";

const asHr = () => getSession.mockResolvedValue({ role: "hr_admin", user: MOCK_USERS.hrAdmin });

const get = (userId: string, query = "") =>
  GET(new Request(`http://localhost/api/audit/${userId}${query}`), {
    params: Promise.resolve({ userId }),
  });

const HISTORY = {
  employee: { id: ELENA, name: "Elena Cruz", role: "employee" },
  requests: [{ id: "r1", status: "approved" }],
};

beforeEach(() => {
  getSession.mockReset();
  getAuditHistory.mockReset();
});

describe("GET /api/audit/:userId", () => {
  it("returns 401 without a session", async () => {
    getSession.mockResolvedValue(null);
    expect((await get(ELENA)).status).toBe(401);
    expect(getAuditHistory).not.toHaveBeenCalled();
  });

  it("employees and managers get 403 and nothing is read", async () => {
    for (const [role, user] of [
      ["employee", MOCK_USERS.employee],
      ["manager", MOCK_USERS.manager],
    ] as const) {
      getSession.mockResolvedValue({ role, user });
      const res = await get(ELENA);
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
    }
    expect(getAuditHistory).not.toHaveBeenCalled();
  });

  it("US-05 AC1: HR gets the history of any employee, including another team's", async () => {
    asHr();
    getAuditHistory.mockResolvedValue(HISTORY);

    const res = await get(LEO);

    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({
      ...HISTORY,
      filters: { include_deleted: false },
    });
    expect(getAuditHistory).toHaveBeenCalledWith(FAKE_SQL, LEO, { include_deleted: false });
  });

  it("US-05 AC2: soft-deleted requests are excluded unless include_deleted=true", async () => {
    asHr();
    getAuditHistory.mockResolvedValue(HISTORY);

    await get(ELENA);
    expect(getAuditHistory).toHaveBeenLastCalledWith(FAKE_SQL, ELENA, { include_deleted: false });

    await get(ELENA, "?include_deleted=true");
    expect(getAuditHistory).toHaveBeenLastCalledWith(FAKE_SQL, ELENA, { include_deleted: true });
  });

  it("passes a date range through", async () => {
    asHr();
    getAuditHistory.mockResolvedValue(HISTORY);
    await get(ELENA, "?from=2026-10-01&to=2026-10-31");
    expect(getAuditHistory).toHaveBeenCalledWith(FAKE_SQL, ELENA, {
      from: "2026-10-01",
      to: "2026-10-31",
      include_deleted: false,
    });
  });

  it("rejects a malformed id, bad dates and a reversed range with 400", async () => {
    asHr();
    for (const [id, q] of [
      ["not-a-uuid", ""],
      [ELENA, "?from=2026-02-30"],
      [ELENA, "?from=2026-10-31&to=2026-10-01"],
      [ELENA, "?include_deleted=maybe"],
    ] as const) {
      const res = await get(id, q);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    }
    expect(getAuditHistory).not.toHaveBeenCalled();
  });

  it("passes an unknown employee through as 404 in the standard envelope", async () => {
    asHr();
    getAuditHistory.mockRejectedValue(new AppError("NOT_FOUND", "No employee with that id."));
    const res = await get(ELENA);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "No employee with that id." },
    });
  });
});
