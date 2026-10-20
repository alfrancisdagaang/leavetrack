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

const setPolicyRate = vi.fn();
const FAKE_SQL = { fake: true };
vi.mock("@/lib/leave/policies", () => ({
  setPolicyRate: (...args: unknown[]) => setPolicyRate(...args),
}));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => FAKE_SQL }));

const { PUT } = await import("@/app/api/leave-policies/route");

const U = "00000000-0000-4000-8000-000000000003";
const T = "10000000-0000-4000-8000-000000000001";
const CHANGED = {
  status: "changed",
  oldRate: "1.25",
  newRate: "1.50",
  changedAt: "2026-10-20T01:41:00.000Z",
  changedByName: "Hana Reyes",
};
const OK_BODY = { user_id: U, leave_type_id: T, accrual_per_month: 1.5 };
const put = (body: unknown) =>
  PUT(
    new Request("http://localhost/api/leave-policies", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    {},
  );
const asHr = () => getSession.mockResolvedValue({ role: "hr_admin", user: MOCK_USERS.hrAdmin });

beforeEach(() => {
  getSession.mockReset();
  setPolicyRate.mockReset();
  setPolicyRate.mockResolvedValue(CHANGED);
});

describe("PUT /api/leave-policies (TASK-071)", () => {
  it("AC2: HR sets a rate; the actor is the SESSION user and the rate is fixed two-decimal text", async () => {
    asHr();
    const res = await put({ ...OK_BODY, changed_by: "someone-else", actor: "x" });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ success: true, data: CHANGED });
    expect(setPolicyRate).toHaveBeenCalledWith(FAKE_SQL, {
      actorId: MOCK_USERS.hrAdmin.id,
      userId: U,
      leaveTypeId: T,
      rate: "1.50",
    });
  });

  it("AC3: a visitor gets 401 in the standard envelope and nothing runs", async () => {
    getSession.mockResolvedValue(null);
    const res = await put(OK_BODY);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    expect(setPolicyRate).not.toHaveBeenCalled();
  });

  it.each(["employee", "manager"] as const)("AC3: a %s gets 403 and nothing runs", async (role) => {
    getSession.mockResolvedValue({ role, user: MOCK_USERS[role] });
    const res = await put(OK_BODY);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(setPolicyRate).not.toHaveBeenCalled();
  });

  it.each([
    ["a negative rate", { ...OK_BODY, accrual_per_month: -1 }],
    ["a rate above 31", { ...OK_BODY, accrual_per_month: 32 }],
    ["three decimals", { ...OK_BODY, accrual_per_month: 1.255 }],
    ["a rate as text", { ...OK_BODY, accrual_per_month: "1.5" }],
    ["a malformed user id", { ...OK_BODY, user_id: "nope" }],
    ["a missing leave type", { user_id: U, accrual_per_month: 1 }],
  ])("AC4: %s is a 400 and nothing is written", async (_n, body) => {
    asHr();
    const res = await put(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(setPolicyRate).not.toHaveBeenCalled();
  });

  it("AC4: a body that is not JSON is a 400", async () => {
    asHr();
    expect((await put("not json")).status).toBe(400);
    expect(setPolicyRate).not.toHaveBeenCalled();
  });

  it("AC4: the service's not-found (a manager, Unpaid, an unknown id) is a 404 envelope", async () => {
    asHr();
    setPolicyRate.mockRejectedValue(
      new AppError("NOT_FOUND", "That employee or leave type was not found."),
    );
    const res = await put(OK_BODY);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });

  it("the SQL role check backs up the route: its FORBIDDEN is a 403 too", async () => {
    asHr();
    setPolicyRate.mockRejectedValue(
      new AppError("FORBIDDEN", "You do not have access to this resource."),
    );
    expect((await put(OK_BODY)).status).toBe(403);
  });

  it("an unchanged rate is a 200 saying so", async () => {
    asHr();
    setPolicyRate.mockResolvedValue({
      status: "unchanged",
      oldRate: "1.50",
      newRate: "1.50",
      changedAt: null,
      changedByName: null,
    });
    const json = await (await put(OK_BODY)).json();
    expect(json.data.status).toBe("unchanged");
  });

  it("an unexpected failure is a 500 that leaks nothing", async () => {
    asHr();
    setPolicyRate.mockRejectedValue(new Error("connection string postgres://secret"));
    const res = await put(OK_BODY);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
