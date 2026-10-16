import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUERY_DEADLINE_MS, SLOW_QUERY_MS, timedQuery } from "@/lib/db/timed";
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
