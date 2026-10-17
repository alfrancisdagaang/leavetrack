import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QUERY_DEADLINE_MS,
  READ_FIRST_ATTEMPT_MS,
  SLOW_QUERY_MS,
  timedQuery,
  timedRead,
} from "@/lib/db/timed";
import { AppError } from "@/lib/errors/app-error";

const log = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: log }));

beforeEach(() => {
  vi.useFakeTimers();
  log.warn.mockReset();
  log.error.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("timedQuery", () => {
  it("returns the result and logs nothing for a fast query", async () => {
    await expect(timedQuery("fast", async () => 42)).resolves.toBe(42);
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("warns with the query name and duration when the query is slow", async () => {
    const run = () =>
      new Promise<string>((resolve) => setTimeout(() => resolve("ok"), SLOW_QUERY_MS + 500));
    const pending = timedQuery("dashboard.calendar", run);
    await vi.advanceTimersByTimeAsync(SLOW_QUERY_MS + 500);
    await expect(pending).resolves.toBe("ok");
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ query: "dashboard.calendar", ms: SLOW_QUERY_MS + 500 }),
      expect.any(String),
    );
  });

  it("logs the name and Postgres code on failure and rethrows the same error", async () => {
    const failure = Object.assign(new Error("canceling statement due to statement timeout"), {
      code: "57014",
    });
    await expect(
      timedQuery("session.find_user", async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ query: "session.find_user", code: "57014" }),
      expect.any(String),
    );
  });

  it("never logs the error text, which could carry SQL or values", async () => {
    await timedQuery("x", async () => {
      throw new Error("select * from users where email = 'a@b.c'");
    }).catch(() => undefined);
    expect(JSON.stringify(log.error.mock.calls)).not.toContain("select");
  });

  it("abandons a query that never answers: SERVICE_UNAVAILABLE and a log line with its name", async () => {
    const pending = timedQuery("dashboard.calendar", () => new Promise<never>(() => {}));
    const settled = pending.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(QUERY_DEADLINE_MS);
    const err = await settled;
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("SERVICE_UNAVAILABLE");
    expect(log.error).toHaveBeenCalledWith(
      expect.objectContaining({ query: "dashboard.calendar", deadlineMs: QUERY_DEADLINE_MS }),
      "Database query hit its deadline",
    );
  });

  it("swallows the late failure of an abandoned query instead of leaving it unhandled", async () => {
    let fail: (e: Error) => void = () => {};
    const pending = timedQuery(
      "late",
      () => new Promise<never>((_r, reject) => (fail = reject)),
      100,
    );
    const settled = pending.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(100);
    await settled;
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    fail(new Error("canceling statement due to statement timeout"));
    await vi.advanceTimersByTimeAsync(10);
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("does not log an expected AppError (such as NOT_FOUND) as a database fault", async () => {
    const notFound = new AppError("NOT_FOUND", "No such employee.");
    await expect(
      timedQuery("audit.history", async () => {
        throw notFound;
      }),
    ).rejects.toBe(notFound);
    expect(log.error).not.toHaveBeenCalled();
  });

  it("leaves no timer running after a fast query", async () => {
    await timedQuery("fast", async () => 1);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("timedRead", () => {
  it("returns a fast result without a retry", async () => {
    const run = vi.fn(async () => "ok");
    await expect(timedRead("fast", run)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("retries once after the first-attempt deadline and returns the second result", async () => {
    let calls = 0;
    const run = vi.fn(() => (++calls === 1 ? new Promise<never>(() => {}) : Promise.resolve("ok")));
    const pending = timedRead("balance.last_accrual", run);
    await vi.advanceTimersByTimeAsync(READ_FIRST_ATTEMPT_MS);
    await expect(pending).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ query: "balance.last_accrual", attempt: 2 }),
      "Retrying read query",
    );
  });

  it("fails with SERVICE_UNAVAILABLE after the total deadline when both attempts stall", async () => {
    const run = vi.fn(() => new Promise<never>(() => {}));
    const settled = timedRead("dashboard.calendar", run).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(QUERY_DEADLINE_MS);
    const err = await settled;
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("SERVICE_UNAVAILABLE");
    expect(run).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("gives the retry only what is left of the deadline, so the total never grows", async () => {
    const run = vi.fn(() => new Promise<never>(() => {}));
    const settled = timedRead("x", run).catch(() => "done");
    await vi.advanceTimersByTimeAsync(QUERY_DEADLINE_MS - 1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(1);
    await expect(settled).resolves.toBe("done");
  });

  it("retries once when the connection went away", async () => {
    const gone = Object.assign(new Error("connection closed"), { code: "CONNECTION_CLOSED" });
    let calls = 0;
    const run = vi.fn(async () => {
      if (++calls === 1) throw gone;
      return "ok";
    });
    await expect(timedRead("session.find_user", run)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does not retry an ordinary database error such as a statement timeout", async () => {
    const failure = Object.assign(new Error("canceling statement"), { code: "57014" });
    const run = vi.fn(async () => {
      throw failure;
    });
    await expect(timedRead("x", run)).rejects.toBe(failure);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not retry a bad password, which a second attempt cannot fix", async () => {
    const failure = Object.assign(new Error("password authentication failed"), { code: "28P01" });
    const run = vi.fn(async () => {
      throw failure;
    });
    await expect(timedRead("x", run)).rejects.toBe(failure);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not retry an expected AppError, even a 503 the query raised itself", async () => {
    const own = new AppError("SERVICE_UNAVAILABLE", "raised by the query, not the deadline");
    const run = vi.fn(async () => {
      throw own;
    });
    await expect(timedRead("x", run)).rejects.toBe(own);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("never logs SQL or values while retrying", async () => {
    let calls = 0;
    const run = () =>
      ++calls === 1 ? new Promise<never>(() => {}) : Promise.resolve("select * from users");
    const pending = timedRead("x", run);
    await vi.advanceTimersByTimeAsync(READ_FIRST_ATTEMPT_MS);
    await pending;
    expect(JSON.stringify([...log.warn.mock.calls, ...log.error.mock.calls])).not.toContain(
      "select",
    );
  });
});
