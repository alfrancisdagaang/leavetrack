import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors/app-error";
import { MOCK_USERS } from "@/lib/mock/users";
import type { Session } from "@/lib/auth/session";

vi.mock("@/lib/logger", () => {
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return { logger: { ...log, child: () => log } };
});

const getSession = vi.fn<() => Promise<Session | null>>();
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const createLeaveRequest = vi.fn();
const getMySummary = vi.fn();
const getTeamQueue = vi.fn();
const FAKE_SQL = { fake: true };
vi.mock("@/lib/leave/team", () => ({
  getTeamQueue: (...args: unknown[]) => getTeamQueue(...args),
}));
vi.mock("@/lib/leave/service", () => ({
  requireDb: () => FAKE_SQL,
  createLeaveRequest: (...args: unknown[]) => createLeaveRequest(...args),
  getMySummary: (...args: unknown[]) => getMySummary(...args),
}));

const { GET, POST } = await import("@/app/api/leave-requests/route");

const TYPE_ID = "10000000-0000-4000-8000-000000000001";
const PRIYA = "00000000-0000-4000-8000-000000000004";
const body = { leave_type_id: TYPE_ID, start_date: "2026-10-20", end_date: "2026-10-22" };

const asEmployee = () =>
  getSession.mockResolvedValue({ role: "employee", user: MOCK_USERS.employee });

function post(payload: unknown, raw = false) {
  return POST(
    new Request("http://localhost/api/leave-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw ? (payload as string) : JSON.stringify(payload),
    }),
    undefined,
  );
}

const get = (query = "") =>
  GET(new Request(`http://localhost/api/leave-requests${query}`), undefined);

beforeEach(() => {
  getSession.mockReset();
  createLeaveRequest.mockReset();
  getMySummary.mockReset();
  getTeamQueue.mockReset();
});

describe("POST /api/leave-requests", () => {
  it("returns 401 without a session", async () => {
    getSession.mockResolvedValue(null);
    const res = await post(body);
    expect(res.status).toBe(401);
    expect(createLeaveRequest).not.toHaveBeenCalled();
  });

  it("US-01 AC1: creates a pending request for the session user, ignoring a spoofed user_id", async () => {
    asEmployee();
    const created = {
      request: { id: "r1", status: "pending", leave_type_id: TYPE_ID },
      warnings: [],
    };
    createLeaveRequest.mockResolvedValue(created);

    const res = await post({ ...body, user_id: "00000000-0000-4000-8000-000000000006" });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ success: true, data: created });
    expect(createLeaveRequest).toHaveBeenCalledWith(
      FAKE_SQL,
      MOCK_USERS.employee.id,
      expect.not.objectContaining({ user_id: expect.anything() }),
    );
  });

  it("lets managers and HR admins request their own leave (roles stack)", async () => {
    createLeaveRequest.mockResolvedValue({ request: {}, warnings: [] });
    getSession.mockResolvedValue({ role: "manager", user: MOCK_USERS.manager });
    expect((await post(body)).status).toBe(201);
    expect(createLeaveRequest).toHaveBeenLastCalledWith(
      FAKE_SQL,
      MOCK_USERS.manager.id,
      expect.anything(),
    );
  });

  it("US-01 AC2: rejects end before start with VALIDATION_ERROR and creates nothing", async () => {
    asEmployee();
    const res = await post({ ...body, start_date: "2026-10-22", end_date: "2026-10-20" });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(createLeaveRequest).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    asEmployee();
    const res = await post("{not json", true);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(createLeaveRequest).not.toHaveBeenCalled();
  });

  it("US-01 AC3: an over-balance request is still created (201) and carries the warning", async () => {
    asEmployee();
    const warning = {
      code: "OVER_BALANCE",
      message: "too many",
      requestedDays: 8,
      availableDays: 7,
    };
    createLeaveRequest.mockResolvedValue({ request: { id: "r2" }, warnings: [warning] });

    const res = await post(body);

    expect(res.status).toBe(201);
    expect((await res.json()).data.warnings).toEqual([warning]);
  });

  it("passes service failures through the standard envelope (no approver → 409)", async () => {
    asEmployee();
    createLeaveRequest.mockRejectedValue(new AppError("CONFLICT", "No approver is assigned."));
    const res = await post(body);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "CONFLICT", message: "No approver is assigned." },
    });
  });
});

describe("GET /api/leave-requests?scope=mine", () => {
  it("returns 401 without a session", async () => {
    getSession.mockResolvedValue(null);
    expect((await get("?scope=mine")).status).toBe(401);
    expect(getMySummary).not.toHaveBeenCalled();
  });

  it("US-02 AC1/AC2: returns the caller's requests and balances, scoped to the session user", async () => {
    asEmployee();
    const summary = {
      requests: [],
      balances: [{ leaveTypeName: "Vacation", confirmed: 10, pending: 3, available: 7 }],
    };
    getMySummary.mockResolvedValue(summary);

    // A client-supplied user_id must have no effect.
    const res = await get("?scope=mine&user_id=00000000-0000-4000-8000-000000000006");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: summary });
    expect(getMySummary).toHaveBeenCalledWith(FAKE_SQL, MOCK_USERS.employee.id);
  });

  it("defaults to scope=mine and rejects an unknown scope", async () => {
    asEmployee();
    getMySummary.mockResolvedValue({ requests: [], balances: [] });
    expect((await get()).status).toBe(200);
    const res = await get("?scope=all");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/leave-requests?scope=team", () => {
  const asManager = () =>
    getSession.mockResolvedValue({ role: "manager", user: MOCK_USERS.manager });

  it("returns 401 without a session", async () => {
    getSession.mockResolvedValue(null);
    expect((await get("?scope=team")).status).toBe(401);
    expect(getTeamQueue).not.toHaveBeenCalled();
  });

  it("US-04: an employee gets 403 and the queue is never queried", async () => {
    asEmployee();
    const res = await get("?scope=team");
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(getTeamQueue).not.toHaveBeenCalled();
  });

  it("US-04 AC1: a manager gets their own team's queue, scoped by the session user id", async () => {
    asManager();
    const queue = [{ id: "r1", employee_name: "Elena Cruz" }];
    getTeamQueue.mockResolvedValue(queue);

    // A client-supplied manager id must have no effect.
    const res = await get(`?scope=team&manager_id=${PRIYA}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { requests: queue } });
    expect(getTeamQueue).toHaveBeenCalledWith(FAKE_SQL, MOCK_USERS.manager.id);
  });

  it("HR admins also get a queue, for their own direct reports", async () => {
    getSession.mockResolvedValue({ role: "hr_admin", user: MOCK_USERS.hrAdmin });
    getTeamQueue.mockResolvedValue([]);
    expect((await get("?scope=team")).status).toBe(200);
    expect(getTeamQueue).toHaveBeenCalledWith(FAKE_SQL, MOCK_USERS.hrAdmin.id);
  });
});
