import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginAction, logoutAction, mockLoginAction } from "@/app/login/actions";
import { MOCK_USERS } from "@/lib/mock/users";

// Real Supabase is not contacted here: the Auth client is a stub whose answers each test controls.
// The live round trip is checked by hand with the login form (see the TASK-022 retro).
const mocks = vi.hoisted(() => ({
  allowMock: true,
  supabase: null as null | {
    auth: {
      signInWithPassword: ReturnType<typeof vi.fn>;
      signOut: ReturnType<typeof vi.fn>;
    };
  },
  sql: undefined as unknown,
  findUserByEmail: vi.fn(),
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet, delete: mocks.cookieDelete }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({ ALLOW_MOCK_LOGIN: mocks.allowMock, APP_ENV: "development" }),
}));
vi.mock("@/lib/db/client", () => ({ getDb: () => mocks.sql }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => mocks.supabase,
}));
vi.mock("@/lib/auth/users", () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock("@/lib/logger", () => ({ logger: mocks.log }));

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const ELENA = { email: "elena.cruz@leavetrack.example", password: "demo-password-123" };
const idle = { error: null };
const authOk = (email = ELENA.email) => ({ data: { user: { id: "auth-1", email } }, error: null });

beforeEach(() => {
  mocks.allowMock = true;
  mocks.sql = {};
  mocks.supabase = {
    auth: { signInWithPassword: vi.fn(), signOut: vi.fn().mockResolvedValue({ error: null }) },
  };
  mocks.supabase.auth.signInWithPassword.mockResolvedValue(authOk());
  mocks.findUserByEmail.mockReset().mockResolvedValue(MOCK_USERS.employee);
  mocks.cookieSet.mockReset();
  mocks.cookieDelete.mockReset();
  mocks.redirect.mockClear();
  for (const fn of Object.values(mocks.log)) fn.mockReset();
});

describe("loginAction", () => {
  it("AC1: a valid email and password signs in and lands on /dashboard", async () => {
    await expect(loginAction(idle, form(ELENA))).rejects.toThrow("REDIRECT:/dashboard");
    expect(mocks.supabase!.auth.signInWithPassword).toHaveBeenCalledWith(ELENA);
    expect(mocks.findUserByEmail).toHaveBeenCalledWith(mocks.sql, ELENA.email);
  });

  it("AC1: honours a safe next path and ignores an external one", async () => {
    await expect(loginAction(idle, form({ ...ELENA, next: "/approvals" }))).rejects.toThrow(
      "REDIRECT:/approvals",
    );
    await expect(loginAction(idle, form({ ...ELENA, next: "//evil.example" }))).rejects.toThrow(
      "REDIRECT:/dashboard",
    );
    await expect(
      loginAction(idle, form({ ...ELENA, next: "https://evil.example" })),
    ).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("AC1: a real sign-in removes a leftover mock-role cookie", async () => {
    await expect(loginAction(idle, form(ELENA))).rejects.toThrow("REDIRECT:");
    expect(mocks.cookieDelete).toHaveBeenCalledWith("mock-role");
  });

  it("AC2: a wrong password and an unknown email show the same message and set no session", async () => {
    const results: string[] = [];
    for (const code of ["invalid_credentials", "user_not_found"]) {
      mocks.supabase!.auth.signInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { code, status: 400 },
      });
      const result = await loginAction(idle, form(ELENA));
      results.push(result.error ?? "");
    }
    expect(results[0]).toBe("Incorrect email or password.");
    expect(results[1]).toBe(results[0]);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    expect(mocks.findUserByEmail).not.toHaveBeenCalled();
  });

  it("AC2: an Auth outage is reported as unavailable, not as bad credentials", async () => {
    mocks.supabase!.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: "unexpected_failure", status: 500 },
    });
    expect((await loginAction(idle, form(ELENA))).error).toMatch(/unavailable/i);
  });

  it("is unavailable, not a crash, when Supabase is not configured", async () => {
    mocks.supabase = null;
    expect((await loginAction(idle, form(ELENA))).error).toMatch(/unavailable/i);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("AC3: a valid account with no users row is signed out again and told it is not set up", async () => {
    mocks.findUserByEmail.mockResolvedValue(null);
    const result = await loginAction(idle, form(ELENA));
    expect(result.error).toBe("Your account is not set up. Ask HR.");
    expect(mocks.supabase!.auth.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("asks for both fields without calling Supabase", async () => {
    const cases: Record<string, string>[] = [
      {},
      { email: ELENA.email },
      { password: "x" },
      { email: "", password: "" },
    ];
    for (const fields of cases) {
      expect((await loginAction(idle, form(fields))).error).toBe("Enter your email and password.");
    }
    expect(mocks.supabase!.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("never logs the password or the email", async () => {
    mocks.findUserByEmail.mockResolvedValue(null);
    await loginAction(idle, form(ELENA));
    mocks.supabase!.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: "invalid_credentials", status: 400 },
    });
    await loginAction(idle, form(ELENA));
    const logged = JSON.stringify(Object.values(mocks.log).flatMap((fn) => fn.mock.calls));
    expect(logged).not.toContain(ELENA.password);
    expect(logged).not.toContain(ELENA.email);
  });
});

describe("logoutAction", () => {
  it("AC4: signs out of Supabase, clears the mock cookie and returns to /login", async () => {
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.supabase!.auth.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.cookieDelete).toHaveBeenCalledWith("mock-role");
  });

  it("AC4: still clears the local session when the Auth server cannot be reached", async () => {
    mocks.supabase!.auth.signOut.mockRejectedValue(new Error("network down"));
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.cookieDelete).toHaveBeenCalledWith("mock-role");
  });

  it("works when Supabase is not configured", async () => {
    mocks.supabase = null;
    await expect(logoutAction()).rejects.toThrow("REDIRECT:/login");
  });
});

describe("mockLoginAction", () => {
  const mockForm = form({ name: "A", email: "a@b.c", role: "manager" });

  it("AC5: refuses and sets no cookie when ALLOW_MOCK_LOGIN is off", async () => {
    mocks.allowMock = false;
    const result = await mockLoginAction(idle, mockForm);
    expect(result.error).toMatch(/switched off/i);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("sets the role cookie and redirects when the flag is on", async () => {
    await expect(mockLoginAction(idle, mockForm)).rejects.toThrow("REDIRECT:/dashboard");
    expect(mocks.cookieSet).toHaveBeenCalledWith("mock-role", "manager", expect.any(Object));
  });

  it("rejects an unknown role", async () => {
    const result = await mockLoginAction(idle, form({ name: "", email: "", role: "root" }));
    expect(result.error).toMatch(/valid role/i);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});
