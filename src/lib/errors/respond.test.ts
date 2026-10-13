import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import { errorResponse, ok, withErrorHandling } from "@/lib/errors/respond";

vi.mock("@/lib/logger", () => {
  const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
  return { logger: { ...log, child: () => log } };
});

describe("error envelope", () => {
  it("maps AppError to its code and status", async () => {
    const res = errorResponse(new AppError("FORBIDDEN", "Not your report."));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "FORBIDDEN", message: "Not your report." },
    });
  });

  it("maps ZodError to VALIDATION_ERROR (400)", async () => {
    const parsed = z.object({ end_date: z.string() }).safeParse({});
    const res = errorResponse(parsed.error);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("never leaks unknown error details", async () => {
    const res = errorResponse(new Error("password=hunter2 at db.ts:42"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: "INTERNAL", message: "An unexpected error occurred." },
    });
  });

  it("wraps success in { success: true, data }", async () => {
    expect(await ok({ a: 1 }).json()).toEqual({ success: true, data: { a: 1 } });
  });
});

describe("withErrorHandling", () => {
  it("converts thrown errors and sets x-request-id", async () => {
    const handler = withErrorHandling(async () => {
      throw new AppError("NOT_FOUND", "No such request.");
    });
    const res = await handler(new Request("http://localhost/api/x"), {});
    expect(res.status).toBe(404);
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("propagates an incoming x-request-id", async () => {
    const handler = withErrorHandling(async () => ok(null));
    const res = await handler(
      new Request("http://localhost/api/x", { headers: { "x-request-id": "abc-123" } }),
      {},
    );
    expect(res.headers.get("x-request-id")).toBe("abc-123");
  });
});
