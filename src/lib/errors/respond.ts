import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, ERROR_STATUS, type ErrorCode } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger";

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: { code: ErrorCode; message: string } };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, init);
}

export function failure(code: ErrorCode, message: string): NextResponse<ApiFailure> {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status: ERROR_STATUS[code] },
  );
}

/** Maps any thrown value to the standard error envelope. Unknown errors never leak details. */
export function errorResponse(err: unknown): NextResponse<ApiFailure> {
  if (err instanceof AppError) return failure(err.code, err.message);
  if (err instanceof ZodError) {
    const message = err.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return failure("VALIDATION_ERROR", message);
  }
  return failure("INTERNAL", "An unexpected error occurred.");
}

type RouteHandler<C> = (request: Request, context: C) => Promise<Response>;

/**
 * Wrap every route handler with this. Adds a request id, logs failures, and guarantees
 * the `{ success: false, error: { code, message } }` envelope on every non-2xx response.
 */
export function withErrorHandling<C>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (request, context) => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    const log = logger.child({
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
    });
    try {
      const response = await handler(request, context);
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (err) {
      if (err instanceof AppError && err.status < 500) {
        log.warn({ code: err.code }, err.message);
      } else if (!(err instanceof ZodError)) {
        log.error({ err }, "Unhandled error in route handler");
      }
      const response = errorResponse(err);
      response.headers.set("x-request-id", requestId);
      return response;
    }
  };
}
