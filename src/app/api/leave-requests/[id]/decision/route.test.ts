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

const decideLeaveRequest = vi.fn();
const FAKE_SQL = { fake: true };
vi.mock("@/lib/leave/decide", () => ({
  decideLeaveRequest: (...args: unknown[]) => decideLeaveRequest(...args),
}));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => FAKE_SQL }));

const { POST } = await import("@/app/api/leave-requests/[id]/decision/route");

const REQ = "30000000-0000-4000-8000-000000000001";
const LEO = "00000000-0000-4000-8000-000000000006";

const asManager = () => getSession.mockResolvedValue({ role: "manager", user: MOCK_USERS.manager });

function decide(id: string, payload: unknown) {
  return POST(
    new Request(`http://localhost/api/leave-requests/${id}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  getSession.mockReset();
  decideLeaveRequest.mockReset();
});

describe("POST /api/leave-requests/:id/decision", () => {
  it("returns 401 without a session", async () => {
    getSession.mockResolvedValue(null);
    expect((await decide(REQ, { decision: "approve" })).status).toBe(401);
    expect(decideLeaveRequest).not.toHaveBeenCalled();
  });

  it("an employee gets 403 and nothing is decided", async () => {
    getSession.mockResolvedValue({ role: "employee", user: MOCK_USERS.employee });
    const res = await decide(REQ, { decision: "approve" });
    expect(res.status).toBe(403);
    expect(decideLeaveRequest).not.toHaveBeenCalled();
  });

  it("US-03 AC1: approve is decided as the session user, ignoring a spoofed decided_by", async () => {
    asManager();
    const result = { request: { id: REQ, status: "approved" }, balance: { balance: 7 } };
    decideLeaveRequest.mockResolvedValue(result);

    const res = await decide(REQ, { decision: "approve", decided_by: LEO, status: "rejected" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: result });
    expect(decideLeaveRequest).toHaveBeenCalledWith(FAKE_SQL, MOCK_USERS.manager.id, REQ, {
      decision: "approve",
    });
  });

  it("US-03 AC2: reject passes the trimmed note through", async () => {
    asManager();
    decideLeaveRequest.mockResolvedValue({ request: { status: "rejected" }, balance: null });
    const res = await decide(REQ, { decision: "reject", note: "  Team is short  " });
    expect(res.status).toBe(200);
    expect(decideLeaveRequest).toHaveBeenCalledWith(FAKE_SQL, MOCK_USERS.manager.id, REQ, {
      decision: "reject",
      note: "Team is short",
    });
  });

  it("US-03 AC2: reject without a reason is a 400 and nothing is decided", async () => {
    asManager();
    for (const payload of [{ decision: "reject" }, { decision: "reject", note: "   " }]) {
      const res = await decide(REQ, payload);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    }
    expect(decideLeaveRequest).not.toHaveBeenCalled();
  });

  it("US-03 AC3: a request outside the caller's team returns 403 in the standard envelope", async () => {
    asManager();
    decideLeaveRequest.mockRejectedValue(
      new AppError("FORBIDDEN", "This request is not from one of your direct reports."),
    );
    const res = await decide(REQ, { decision: "approve" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "This request is not from one of your direct reports.",
      },
    });
  });

  it("passes 409s through (already decided, insufficient balance)", async () => {
    asManager();
    decideLeaveRequest.mockRejectedValue(new AppError("CONFLICT", "Insufficient balance."));
    const res = await decide(REQ, { decision: "approve" });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("CONFLICT");
  });

  it("rejects a malformed id and a body that is not JSON", async () => {
    asManager();
    expect((await decide("not-a-uuid", { decision: "approve" })).status).toBe(400);
    expect((await decide(REQ, "{nope")).status).toBe(400);
    expect(decideLeaveRequest).not.toHaveBeenCalled();
  });

  it("EPIC-10 AC1: an HR admin and an employee get 403 and a clear message; nothing is decided", async () => {
    for (const [role, user] of [
      ["hr_admin", MOCK_USERS.hrAdmin],
      ["employee", MOCK_USERS.employee],
    ] as const) {
      getSession.mockResolvedValue({ role, user });
      const res = await decide(REQ, { decision: "approve" });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
      expect(json.error.message).toContain("Only managers can approve or reject");
    }
    expect(decideLeaveRequest).not.toHaveBeenCalled();
  });
});
