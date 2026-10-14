import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors/app-error";

vi.mock("@/lib/logger", () => {
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return { logger: { ...log, child: () => log } };
});

const SECRET = "s".repeat(40);
vi.mock("@/lib/env", () => ({ getEnv: () => ({ CRON_SECRET: SECRET }) }));

const runAccrual = vi.fn();
const FAKE_SQL = { fake: true };
vi.mock("@/lib/leave/accrual", () => ({
  runAccrual: (...args: unknown[]) => runAccrual(...args),
}));
vi.mock("@/lib/leave/service", () => ({ requireDb: () => FAKE_SQL }));

const { GET, POST } = await import("@/app/api/jobs/accrual/route");

const RESULT = {
  period: "2026-10",
  periods_accrued: ["2026-10"],
  ledger_entries: 14,
  balances_updated: 14,
};

const call = (method: "GET" | "POST", headers: Record<string, string> = {}) =>
  (method === "GET" ? GET : POST)(
    new Request("http://localhost/api/jobs/accrual", { method, headers }),
    undefined,
  );

beforeEach(() => {
  runAccrual.mockReset();
});

describe.each(["GET", "POST"] as const)("%s /api/jobs/accrual", (method) => {
  it("rejects a request with no credentials and never runs the job", async () => {
    const res = await call(method);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid cron credentials." },
    });
    expect(runAccrual).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret and a session cookie on its own", async () => {
    expect((await call(method, { authorization: "Bearer wrong" })).status).toBe(401);
    expect((await call(method, { authorization: `Basic ${SECRET}` })).status).toBe(401);
    expect((await call(method, { cookie: "mock-role=hr_admin" })).status).toBe(401);
    expect(runAccrual).not.toHaveBeenCalled();
  });

  it("with the bearer secret runs the accrual once, for the current time", async () => {
    runAccrual.mockResolvedValue(RESULT);
    const before = Date.now();

    const res = await call(method, { authorization: `Bearer ${SECRET}` });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: RESULT });
    expect(runAccrual).toHaveBeenCalledTimes(1);
    const [sql, now] = runAccrual.mock.calls[0] as [unknown, Date];
    expect(sql).toBe(FAKE_SQL);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("US-07 AC2: running it again returns the no-op result, not an error", async () => {
    runAccrual.mockResolvedValue({
      ...RESULT,
      periods_accrued: [],
      ledger_entries: 0,
      balances_updated: 0,
    });
    const res = await call(method, { authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    expect((await res.json()).data.ledger_entries).toBe(0);
  });

  it("returns the standard envelope, without leaking details, when the job fails", async () => {
    runAccrual.mockRejectedValue(new Error("password=hunter2 at db.ts:42"));
    const res = await call(method, { authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "INTERNAL", message: "An unexpected error occurred." },
    });
  });

  it("passes expected failures through (e.g. database not configured)", async () => {
    runAccrual.mockRejectedValue(new AppError("INTERNAL", "The database is not configured."));
    const res = await call(method, { authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(500);
    expect((await res.json()).error.message).toBe("The database is not configured.");
  });
});
