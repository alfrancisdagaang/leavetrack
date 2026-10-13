import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const SECRET = "c".repeat(64);

// Fresh module graph per test so getEnv() re-reads stubbed env vars.
async function run(path: string, init?: { cookie?: string; authorization?: string }) {
  const headers = new Headers();
  if (init?.cookie) headers.set("cookie", init.cookie);
  if (init?.authorization) headers.set("authorization", init.authorization);
  const { proxy } = await import("@/proxy");
  return proxy(new NextRequest(new URL(path, "http://localhost:3000"), { headers }));
}

vi.mock("@/lib/logger", () => {
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return { logger: { ...log, child: () => log } };
});

afterEach(() => vi.resetModules());

describe("proxy — pages", () => {
  it("redirects unauthenticated page requests to /login with next", async () => {
    const res = await run("/dashboard?x=1");
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard?x=1");
  });

  it("lets a valid session through", async () => {
    const res = await run("/dashboard", { cookie: "mock-role=manager" });
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("treats an unknown role as no session and clears the cookie", async () => {
    const res = await run("/dashboard", { cookie: "mock-role=superuser" });
    expect(res.status).toBe(307);
    expect(res.headers.get("set-cookie")).toMatch(/mock-role=;/);
  });

  it("serves /login publicly and bounces signed-in users to /dashboard", async () => {
    expect((await run("/login")).headers.get("x-middleware-next")).toBe("1");
    const res = await run("/login", { cookie: "mock-role=employee" });
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dashboard");
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
