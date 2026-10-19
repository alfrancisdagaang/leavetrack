import { assertRole } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors/app-error";
import { ok, withErrorHandling } from "@/lib/errors/respond";
import { overrideLeaveRequest } from "@/lib/leave/override";
import { decisionSchema, requestIdSchema } from "@/lib/leave/schemas";
import { requireDb } from "@/lib/leave/service";

export const dynamic = "force-dynamic";
/** No request may run for the platform default of 300 s: a hang fails fast and is logged. */
export const maxDuration = 30;

type Context = { params: Promise<{ id: string }> };

/**
 * PRD US-01 AC3 — an HR Admin overrides (approve) or rejects one pending OVER-BALANCE request.
 * HR Admin only. Unlike the manager decision route this is not scoped to a team: the SQL scope is
 * "not the caller's own request" plus the over-balance condition (a documented exception to
 * AGENTS.md rule 3, see `overrideLeaveRequest`). The decider is always the session user, never a
 * value from the body.
 */
export const POST = withErrorHandling<Context>(async (request, context) => {
  const session = await assertRole("hr_admin");
  const { id } = await context.params;
  const requestId = requestIdSchema.parse(id);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const input = decisionSchema.parse(body);

  return ok(await overrideLeaveRequest(requireDb(), session.user.id, requestId, input));
});
