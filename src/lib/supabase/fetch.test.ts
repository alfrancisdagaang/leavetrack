import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeadlineError, fetchWithDeadline, withDeadline } from "@/lib/supabase/fetch";

const log = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logger: log }));

/** A fetch that never answers on its own, but honours abort like the real one. */
function hangingFetch() {
  return vi.fn(
    (_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  log.warn.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchWithDeadline", () => {
  it("passes a fast call straight through", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok")));
    const res = await fetchWithDeadline(
      "auth.get_user",
      1000,
    )("https://x.supabase.co/auth/v1/user");
    expect(await res.text()).toBe("ok");
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("gives up on a call that never answers and names the stage", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const call = fetchWithDeadline("proxy.get_claims", 1000)("https://x.supabase.co/auth/v1/user");
    const settled = call.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1000);
    const err = await settled;
    expect(err).toBeInstanceOf(DeadlineError);
    expect((err as DeadlineError).stage).toBe("proxy.get_claims");
    expect(log.warn).toHaveBeenCalledWith(
      { stage: "proxy.get_claims", ms: 1000 },
      expect.any(String),
    );
  });

  it("logs the stage and limit only, never the URL or headers", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const call = fetchWithDeadline("auth.get_user", 500)(
      "https://secret-ref.supabase.co/auth/v1/user",
      {
        headers: { Authorization: "Bearer SECRET-TOKEN" },
      },
    );
    const settled = call.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(500);
    await settled;
    const logged = JSON.stringify(log.warn.mock.calls);
    expect(logged).not.toContain("secret-ref");
    expect(logged).not.toContain("SECRET-TOKEN");
  });

  it("does not turn the caller's own abort into a deadline error", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();
    const call = fetchWithDeadline("auth.get_user", 1000)("https://x.supabase.co/auth/v1/user", {
      signal: controller.signal,
    });
    const settled = call.catch((e: unknown) => e);
    controller.abort(new Error("caller gave up"));
    const err = await settled;
    expect(err).not.toBeInstanceOf(DeadlineError);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("after one timeout, later calls from the same client fail at once (no retry storm)", async () => {
    const hang = hangingFetch();
    vi.stubGlobal("fetch", hang);
    const f = fetchWithDeadline("proxy.get_claims", 1000);
    const first = f("https://x.supabase.co/a").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await first).toBeInstanceOf(DeadlineError);
    await expect(f("https://x.supabase.co/b")).rejects.toBeInstanceOf(DeadlineError);
    expect(hang).toHaveBeenCalledTimes(1);
  });
});

describe("withDeadline", () => {
  it("returns the result of a fast call and leaves no timer behind", async () => {
    await expect(withDeadline("auth.get_user", async () => 7, 1000)).resolves.toBe(7);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds a call that never finishes, however many retries it makes inside", async () => {
    const pending = withDeadline("auth.get_user", () => new Promise<never>(() => {}), 1000);
    const settled = pending.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1000);
    const err = await settled;
    expect(err).toBeInstanceOf(DeadlineError);
    expect((err as DeadlineError).stage).toBe("auth.get_user");
    expect(log.warn).toHaveBeenCalledWith({ stage: "auth.get_user", ms: 1000 }, expect.any(String));
  });

  it("passes the call's own failure through untouched", async () => {
    const boom = new Error("boom");
    await expect(
      withDeadline("auth.get_user", async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });
});
