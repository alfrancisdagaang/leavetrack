import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session, SessionSource } from "@/lib/auth/session";
import { AppError } from "@/lib/errors/app-error";
import { MOCK_USER_BY_ROLE, MOCK_USERS } from "@/lib/mock/users";

const logs = vi.hoisted(() => ({ lines: [] as string[] }));
vi.mock("@/lib/logger", () => {
  const record = (...args: unknown[]) => void logs.lines.push(JSON.stringify(args));
  const log = { warn: record, error: record, info: record };
  return { logger: { ...log, child: () => log } };
});

const getSession = vi.fn<() => Promise<Session | null>>();
const getSessionSource = vi.fn<() => Promise<SessionSource | null>>();
vi.mock("@/lib/auth/session", () => ({
  getSession: () => getSession(),
  getSessionSource: () => getSessionSource(),
}));
const changePassword = vi.fn();
vi.mock("@/lib/auth/change-password", () => ({
  changePassword: (...args: unknown[]) => changePassword(...args),
}));

const { POST } = await import("@/app/api/account/password/route");

const BODY = {
  current_password: "OldPass-Secret1",
  new_password: "NewPass-Secret2",
  confirm_password: "NewPass-Secret2",
};
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    {},
  );

beforeEach(() => {
  logs.lines.length = 0;
  getSession.mockReset();
  getSessionSource.mockReset();
  changePassword.mockReset();
  getSession.mockResolvedValue({ role: "employee", user: MOCK_USERS.employee });
  getSessionSource.mockResolvedValue("supabase");
});

describe("POST /api/account/password (TASK-065)", () => {
  it("AC4: a visitor without a session gets 401 in the standard envelope and nothing runs", async () => {
    getSession.mockResolvedValue(null);
    const res = await post(BODY);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("AC3: a mock-login session is refused with 403 and nothing runs", async () => {
    getSessionSource.mockResolvedValue("mock");
    const res = await post(BODY);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN");
    expect(json.error.message).toContain("demo login");
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("AC1: changes the password for the SESSION's email and says so, uncached", async () => {
    const res = await post({ ...BODY, email: "someone.else@example.com" });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ success: true, data: { changed: true } });
    expect(changePassword).toHaveBeenCalledWith(
      MOCK_USERS.employee.email,
      BODY.current_password,
      BODY.new_password,
    );
  });

  it.each(["employee", "manager", "hr_admin"] as const)(
    "any role may call it: %s",
    async (role) => {
      getSession.mockResolvedValue({ role, user: MOCK_USER_BY_ROLE[role] });
      expect((await post(BODY)).status).toBe(200);
    },
  );

  it.each([
    ["a mismatched confirmation", { ...BODY, confirm_password: "Different-Pass9" }],
    ["a too-short new password", { ...BODY, new_password: "short", confirm_password: "short" }],
    [
      "a new password equal to the current one",
      { ...BODY, new_password: BODY.current_password, confirm_password: BODY.current_password },
    ],
    ["a missing field", { new_password: BODY.new_password }],
  ])("AC2: %s is a 400 and nothing changes", async (_name, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("AC2: a body that is not JSON is a 400", async () => {
    const res = await post("not json");
    expect(res.status).toBe(400);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("AC2: a wrong current password (the service's answer) is a 400 with its message", async () => {
    changePassword.mockRejectedValue(
      new AppError("VALIDATION_ERROR", "Your current password is incorrect."),
    );
    const res = await post(BODY);
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toBe("Your current password is incorrect.");
  });

  it("an Auth outage is a 503", async () => {
    changePassword.mockRejectedValue(
      new AppError("SERVICE_UNAVAILABLE", "Password change is unavailable right now."),
    );
    expect((await post(BODY)).status).toBe(503);
  });

  it("AC4: no password appears in any response body or log line, success or failure", async () => {
    const bodies: string[] = [];
    bodies.push(await (await post(BODY)).text());
    bodies.push(await (await post({ ...BODY, confirm_password: "Nope-Secret3" })).text());
    changePassword.mockRejectedValue(new Error(`boom ${BODY.new_password}`));
    bodies.push(await (await post(BODY)).text());
    const all = [...bodies, ...logs.lines].join("\n");
    for (const secret of [BODY.current_password, BODY.new_password, "Nope-Secret3"]) {
      expect(all.replaceAll("[REDACTED]", "")).not.toContain(secret.replace("boom ", ""));
    }
  });
});
