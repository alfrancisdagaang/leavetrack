import { NextRequest } from "next/server";
import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "c".repeat(64);

// Fresh module graph per test so getEnv() re-reads stubbed env vars.
async function run(path: string, init?: { cookie?: string; authorization?: string }) {
  const headers = new Headers();
  if (init?.cookie) headers.set("cookie", init.cookie);
  if (init?.authorization) headers.set("authorization", init.authorization);
  const { proxy } = await import("@/proxy");
  return proxy(new NextRequest(new URL(path, "http://localhost:3000"), { headers }));
}

// Real Supabase is not contacted here: the session check is a stub whose answer each test controls.
// The live round trip (cookies, refresh, signing keys) is proved with the login form in TASK-022.
const supabase = vi.hoisted(() => ({
  claims: null as { sub: string } | null,
  throws: false,
  retryable: false,
  refreshed: [] as { name: string; value: string }[],
  // What the proxy asked createServerClient for, to prove it overrides the library's cookie defaults.
  cookieOptions: undefined as object | undefined,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts: {
      cookieOptions?: object;
      cookies: {
        setAll: (c: { name: string; value: string; options: object }[], h: object) => void;
      };
    },
  ) => {
    supabase.cookieOptions = opts.cookieOptions;
    return {
      auth: {
        getClaims: async () => {
          if (supabase.throws) throw new Error("auth server unreachable");
          if (supabase.retryable) {
            return { data: null, error: new AuthRetryableFetchError("fetch failed", 0) };
          }
          if (supabase.refreshed.length) {
            opts.cookies.setAll(
              supabase.refreshed.map((c) => ({ ...c, options: { path: "/", httpOnly: true } })),
              { "Cache-Control": "no-store" },
            );
          }
          return { data: supabase.claims ? { claims: supabase.claims } : null, error: null };
        },
      },
    };
  },
}));

vi.mock("@/lib/logger", () => {
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return { logger: { ...log, child: () => log } };
});

beforeEach(() => {
  supabase.claims = null;
  supabase.throws = false;
  supabase.retryable = false;
  supabase.refreshed = [];
  supabase.cookieOptions = undefined;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("ALLOW_MOCK_LOGIN", "true");
});

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

const SB_COOKIE = "sb-abc-auth-token=whatever";

describe("proxy — pages", () => {
  it("AC1: redirects unauthenticated page requests to /login with next", async () => {
    const res = await run("/dashboard?x=1");
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard?x=1");
  });

  it("AC1: a Supabase cookie that does not validate is no session", async () => {
    const res = await run("/dashboard", { cookie: SB_COOKIE });
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("an Auth outage is not a logout: pages are let through to re-check, and grant nothing themselves", async () => {
    for (const mode of ["throws", "retryable"] as const) {
      supabase.throws = mode === "throws";
      supabase.retryable = mode === "retryable";
      const res = await run("/dashboard", { cookie: SB_COOKIE });
      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-next")).toBe("1");
      expect(res.headers.get("location")).toBeNull();
    }
  });

  it("an Auth outage gives API calls a 503 envelope, not a 401", async () => {
    supabase.retryable = true;
    const res = await run("/api/leave-requests", { cookie: SB_COOKIE });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE" },
    });
  });

  it("an Auth outage does not change /api/jobs, which uses the cron bearer only", async () => {
    supabase.retryable = true;
    const res = await run("/api/jobs/accrual", { cookie: SB_COOKIE });
    expect(res.status).toBe(401);
  });

  it("AC2: lets a valid Supabase session through", async () => {
    supabase.claims = { sub: "user-1" };
    const res = await run("/dashboard", { cookie: SB_COOKIE });
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("AC2: carries refreshed session cookies onto the response", async () => {
    supabase.claims = { sub: "user-1" };
    supabase.refreshed = [{ name: "sb-abc-auth-token", value: "fresh" }];
    const res = await run("/dashboard", { cookie: SB_COOKIE });
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("set-cookie")).toMatch(/sb-abc-auth-token=fresh/);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("TASK-025 AC2: asks for httpOnly, Secure session cookies instead of the library defaults", async () => {
    vi.stubEnv("APP_ENV", "staging");
    supabase.claims = { sub: "user-1" };
    await run("/dashboard", { cookie: SB_COOKIE });
    expect(supabase.cookieOptions).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
    });
  });

  it("carries refreshed cookies onto a redirect and onto a 401 too", async () => {
    supabase.refreshed = [{ name: "sb-abc-auth-token", value: "cleared" }];
    const page = await run("/dashboard", { cookie: SB_COOKIE });
    expect(page.status).toBe(307);
    expect(page.headers.get("set-cookie")).toMatch(/sb-abc-auth-token=cleared/);
    const api = await run("/api/leave-requests", { cookie: SB_COOKIE });
    expect(api.status).toBe(401);
    expect(api.headers.get("set-cookie")).toMatch(/sb-abc-auth-token=cleared/);
  });

  it("AC3: with ALLOW_MOCK_LOGIN on, the mock-role cookie is a session", async () => {
    const res = await run("/dashboard", { cookie: "mock-role=manager" });
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("AC3: with ALLOW_MOCK_LOGIN off, the mock-role cookie grants nothing and is cleared", async () => {
    vi.stubEnv("ALLOW_MOCK_LOGIN", "false");
    const res = await run("/dashboard", { cookie: "mock-role=manager" });
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    expect(res.headers.get("set-cookie")).toMatch(/mock-role=;/);
  });

  it("AC3: with the flag off the mock cookie does not open the API either", async () => {
    vi.stubEnv("ALLOW_MOCK_LOGIN", "false");
    const res = await run("/api/leave-requests", { cookie: "mock-role=hr_admin" });
    expect(res.status).toBe(401);
  });

  it("a real Supabase session is kept when a stale mock cookie is cleared (flag off)", async () => {
    vi.stubEnv("ALLOW_MOCK_LOGIN", "false");
    supabase.claims = { sub: "user-1" };
    const res = await run("/dashboard", { cookie: `${SB_COOKIE}; mock-role=manager` });
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("set-cookie")).toMatch(/mock-role=;/);
  });

  it("treats an unknown role as no session and clears the cookie", async () => {
    const res = await run("/dashboard", { cookie: "mock-role=superuser" });
    expect(res.status).toBe(307);
    expect(res.headers.get("set-cookie")).toMatch(/mock-role=;/);
  });

  it("works without Supabase configured (mock-only)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect((await run("/dashboard")).status).toBe(307);
    const res = await run("/dashboard", { cookie: "mock-role=employee" });
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("serves /login to everyone and never bounces from it (the page decides)", async () => {
    expect((await run("/login")).headers.get("x-middleware-next")).toBe("1");
    supabase.claims = { sub: "user-1" };
    const res = await run("/login", { cookie: SB_COOKIE });
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("proxy — API", () => {
  it("keeps /api/health public", async () => {
    expect((await run("/api/health")).headers.get("x-middleware-next")).toBe("1");
  });

  it("returns the 401 envelope for unauthenticated API calls", async () => {
    const res = await run("/api/leave-requests");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  });
});

describe("proxy — cron jobs", () => {
  it("rejects /api/jobs/* without the bearer secret, even with a session", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const res = await run("/api/jobs/accrual", { cookie: "mock-role=hr_admin" });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("accepts /api/jobs/* with the bearer secret", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const res = await run("/api/jobs/accrual", { authorization: `Bearer ${SECRET}` });
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await run("/api/jobs/accrual", { authorization: "Bearer " });
    expect(res.status).toBe(401);
  });
});

describe("proxy matcher: public static brand assets", () => {
  it("skips the logo, the icons and the tab icon (the sign-in page shows them to signed-out visitors) and nothing else", async () => {
    const { config } = await import("@/proxy");
    const guarded = new RegExp(`^${config.matcher[0]}$`);
    for (const path of ["/icons/logo.svg", "/icons/nav-house.svg", "/icon.svg", "/favicon.ico"]) {
      expect(guarded.test(path), path).toBe(false);
    }
    for (const path of [
      "/dashboard",
      "/audit",
      "/api/leave-requests",
      "/approvals/team",
      "/login",
    ]) {
      expect(guarded.test(path), path).toBe(true);
    }
  });
});
