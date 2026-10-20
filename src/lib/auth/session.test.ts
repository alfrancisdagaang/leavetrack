import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSession,
  getSessionSource,
  parseRole,
  SESSION_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors/app-error";
import { MOCK_USERS } from "@/lib/mock/users";

const mocks = vi.hoisted(() => ({
  cookieValue: undefined as string | undefined,
  allowMock: true,
  supabase: null as unknown,
  sql: undefined as unknown,
  findUserByEmail: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "mock-role" && mocks.cookieValue ? { value: mocks.cookieValue } : undefined,
  }),
}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ ALLOW_MOCK_LOGIN: mocks.allowMock }) }));
vi.mock("@/lib/db/client", () => ({ getDb: () => mocks.sql }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => mocks.supabase,
}));
vi.mock("@/lib/auth/users", () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: mocks.warn, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const supabaseUser = (email: string | undefined) => ({
  auth: {
    getUser: async () => ({ data: { user: email ? { id: "auth-1", email } : null }, error: null }),
  },
});

describe("parseRole", () => {
  it.each(["employee", "manager", "hr_admin"])("accepts %s", (role) => {
    expect(parseRole(role)).toBe(role);
  });

  it.each([undefined, "", "admin", "HR_ADMIN", "manager "])("rejects %j", (value) => {
    expect(parseRole(value)).toBeNull();
  });
});

describe("sessionCookieOptions", () => {
  it("is httpOnly, lax, 8h", () => {
    const opts = sessionCookieOptions("development");
    expect(opts).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(SESSION_MAX_AGE_SECONDS).toBe(8 * 60 * 60);
    expect(opts.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("is Secure outside local development", () => {
    expect(sessionCookieOptions("development", "development").secure).toBe(false);
    expect(sessionCookieOptions("staging", "production").secure).toBe(true);
    expect(sessionCookieOptions("production", "production").secure).toBe(true);
  });

  it("is Secure in a production build even when APP_ENV is left unset", () => {
    expect(sessionCookieOptions("development", "production").secure).toBe(true);
  });
});

describe("getSession", () => {
  const fakeSql = {};
  beforeEach(() => {
    mocks.cookieValue = undefined;
    mocks.allowMock = true;
    mocks.supabase = null;
    mocks.sql = fakeSql;
    mocks.findUserByEmail.mockReset();
    mocks.warn.mockReset();
  });

  it("AC1: a valid session whose email has a users row returns that row's id, role and manager", async () => {
    mocks.supabase = supabaseUser("Elena.Cruz@leavetrack.example");
    mocks.findUserByEmail.mockResolvedValue(MOCK_USERS.employee);
    const session = await getSession();
    expect(session).toEqual({ role: "employee", user: MOCK_USERS.employee });
    expect(session?.user.manager_id).toBe(MOCK_USERS.manager.id);
    expect(mocks.findUserByEmail).toHaveBeenCalledWith(fakeSql, "Elena.Cruz@leavetrack.example");
  });

  it("AC2: a valid session for an email with no users row returns no session", async () => {
    mocks.supabase = supabaseUser("stranger@example.com");
    mocks.findUserByEmail.mockResolvedValue(null);
    expect(await getSession()).toBeNull();
    expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain("stranger@example.com");
  });

  it("AC3: with ALLOW_MOCK_LOGIN off the mock-role cookie yields no session", async () => {
    mocks.cookieValue = "manager";
    mocks.allowMock = false;
    expect(await getSession()).toBeNull();
  });

  it("with ALLOW_MOCK_LOGIN on the mock-role cookie still yields the mock user", async () => {
    mocks.cookieValue = "manager";
    expect(await getSession()).toEqual({ role: "manager", user: MOCK_USERS.manager });
  });

  it("an unknown mock role is no session", async () => {
    mocks.cookieValue = "admin";
    expect(await getSession()).toBeNull();
  });

  it("a real Supabase user wins over a lingering mock cookie", async () => {
    mocks.cookieValue = "hr_admin";
    mocks.supabase = supabaseUser("elena.cruz@leavetrack.example");
    mocks.findUserByEmail.mockResolvedValue(MOCK_USERS.employee);
    expect((await getSession())?.role).toBe("employee");
  });

  it("a signed-in account with no users row and the mock flag off stays signed out despite a mock cookie", async () => {
    mocks.supabase = supabaseUser("stranger@example.com");
    mocks.findUserByEmail.mockResolvedValue(null);
    mocks.allowMock = false;
    mocks.cookieValue = "hr_admin";
    expect(await getSession()).toBeNull();
  });

  it("fails closed without a Supabase user, a database, or when the lookup throws", async () => {
    mocks.supabase = supabaseUser(undefined);
    expect(await getSession()).toBeNull();

    mocks.supabase = supabaseUser("elena.cruz@leavetrack.example");
    mocks.sql = undefined;
    expect(await getSession()).toBeNull();
  });

  it("a database failure while resolving the user is 'unavailable', never a session and never a silent sign-out", async () => {
    mocks.supabase = supabaseUser("elena.cruz@leavetrack.example");
    mocks.findUserByEmail.mockRejectedValue(
      Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" }),
    );
    const err = await getSession().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("SERVICE_UNAVAILABLE");
    expect((err as AppError).status).toBe(503);
    expect((err as AppError).message).not.toContain("statement timeout");
  });

  it("an unreachable Auth server is 'unavailable', not signed out", async () => {
    mocks.supabase = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: new AuthRetryableFetchError("fetch failed", 0),
        }),
      },
    };
    const err = await getSession().catch((e: unknown) => e);
    expect((err as AppError).code).toBe("SERVICE_UNAVAILABLE");
  });

  it("an invalid or missing Auth session is still just 'no session'", async () => {
    mocks.supabase = {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: { status: 401, name: "AuthApiError" },
        }),
      },
    };
    expect(await getSession()).toBeNull();
  });

  it("lets Next's own control-flow errors pass through instead of treating them as signed out", async () => {
    mocks.supabase = supabaseUser("elena.cruz@leavetrack.example");
    mocks.findUserByEmail.mockRejectedValue(
      Object.assign(new Error("Dynamic server usage"), { digest: "DYNAMIC_SERVER_USAGE" }),
    );
    await expect(getSession()).rejects.toThrow(/Dynamic server usage/);
  });
});

describe("getSessionSource (TASK-065)", () => {
  beforeEach(() => {
    mocks.cookieValue = undefined;
    mocks.allowMock = true;
    mocks.supabase = null;
    mocks.sql = {};
    mocks.findUserByEmail.mockReset();
  });

  it("is 'supabase' for a real account, 'mock' for the cookie and null for no session", async () => {
    mocks.supabase = supabaseUser("elena.cruz@leavetrack.example");
    mocks.findUserByEmail.mockResolvedValue(MOCK_USERS.employee);
    expect(await getSessionSource()).toBe("supabase");

    mocks.supabase = null;
    mocks.cookieValue = "manager";
    expect(await getSessionSource()).toBe("mock");

    mocks.cookieValue = undefined;
    expect(await getSessionSource()).toBeNull();
  });

  it("a real account wins over a lingering mock cookie, and getSession is unchanged", async () => {
    mocks.cookieValue = "hr_admin";
    mocks.supabase = supabaseUser("elena.cruz@leavetrack.example");
    mocks.findUserByEmail.mockResolvedValue(MOCK_USERS.employee);
    expect(await getSessionSource()).toBe("supabase");
    expect(await getSession()).toEqual({ role: "employee", user: MOCK_USERS.employee });
  });
});
