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

const overrideLeaveRequest = vi.fn();
const FAKE_SQL = { fake: true };
vi.mock("@/lib/leave/override", () => ({
  overrideLeaveRequest: (...args: unknown[]) => overrideLeaveRequest(...args),
}));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => FAKE_SQL }));

const { POST } = await import("@/app/api/leave-requests/[id]/override/route");

const REQ = "30000000-0000-4000-8000-000000000001";
const LEO = "00000000-0000-4000-8000-000000000006";

const asHr = () => getSession.mockResolvedValue({ role: "hr_admin", user: MOCK_USERS.hrAdmin });

function override(id: string, payload: unknown) {
  return POST(
    new Request(`http://localhost/api/leave-requests/${id}/override`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  getSession.mockReset();
  overrideLeaveRequest.mockReset();
});

describe("POST /api/leave-requests/:id/override", () => {
  it("returns 401 without a session", async () => {
    getSession.mockResolvedValue(null);
    const res = await override(REQ, { decision: "approve" });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ success: false, error: { code: "UNAUTHORIZED" } });
    expect(overrideLeaveRequest).not.toHaveBeenCalled();
  });

  it("AC3: an employee and a manager get 403 and nothing is overridden", async () => {
    getSession.mockResolvedValue({ role: "employee", user: MOCK_USERS.employee });
    expect((await override(REQ, { decision: "approve" })).status).toBe(403);
    getSession.mockResolvedValue({ role: "manager", user: MOCK_USERS.manager });
    const res = await override(REQ, { decision: "approve" });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(overrideLeaveRequest).not.toHaveBeenCalled();
  });

  it("AC1: HR overrides as the session user, ignoring a spoofed decided_by or status", async () => {
    asHr();
    const result = {
      request: { id: REQ, status: "approved" },
      balance: { balance: 0 },
      shortfall: "3.00",
    };
    overrideLeaveRequest.mockResolvedValue(result);

    const res = await override(REQ, { decision: "approve", decided_by: LEO, status: "rejected" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: result });
    expect(overrideLeaveRequest).toHaveBeenCalledWith(FAKE_SQL, MOCK_USERS.hrAdmin.id, REQ, {
      decision: "approve",
    });
  });

  it("AC2: reject passes the trimmed note through", async () => {
    asHr();
    overrideLeaveRequest.mockResolvedValue({
      request: { status: "rejected" },
      balance: null,
      shortfall: null,
    });
    const res = await override(REQ, { decision: "reject", note: "  No cover that week  " });
    expect(res.status).toBe(200);
    expect(overrideLeaveRequest).toHaveBeenCalledWith(FAKE_SQL, MOCK_USERS.hrAdmin.id, REQ, {
      decision: "reject",
      note: "No cover that week",
    });
  });

  it("AC2: reject without a note, or with one over 500 characters, is a 400", async () => {
    asHr();
    for (const payload of [
      { decision: "reject" },
      { decision: "reject", note: "   " },
      { decision: "reject", note: "x".repeat(501) },
    ]) {
      const res = await override(REQ, payload);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    }
    expect(overrideLeaveRequest).not.toHaveBeenCalled();
  });

  it("rejects a bad id, an unknown decision and a body that is not JSON with a 400", async () => {
    asHr();
    expect((await override("not-a-uuid", { decision: "approve" })).status).toBe(400);
    expect((await override(REQ, { decision: "maybe" })).status).toBe(400);
    const res = await override(REQ, "{not json");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(overrideLeaveRequest).not.toHaveBeenCalled();
  });

  it("AC3/AC4/AC6: 403 and 409 from the module come back in the standard envelope", async () => {
    asHr();
    overrideLeaveRequest.mockRejectedValueOnce(
      new AppError("FORBIDDEN", "This request is not available for an HR override."),
    );
    const own = await override(REQ, { decision: "approve" });
    expect(own.status).toBe(403);
    expect(await own.json()).toEqual({
      success: false,
      error: { code: "FORBIDDEN", message: "This request is not available for an HR override." },
    });

    overrideLeaveRequest.mockRejectedValueOnce(
      new AppError("CONFLICT", "This request has already been approved."),
    );
    const again = await override(REQ, { decision: "approve" });
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe("CONFLICT");
  });
});
