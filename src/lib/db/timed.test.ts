import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SLOW_QUERY_MS, timedQuery } from "@/lib/db/timed";

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
});
