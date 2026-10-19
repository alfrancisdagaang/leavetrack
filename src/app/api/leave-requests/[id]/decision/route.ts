import { assertRole } from "@/lib/auth/guards";
import { APPROVERS_ONLY_MESSAGE, canApproveLeave } from "@/lib/auth/roles";
import { AppError } from "@/lib/errors/app-error";
import { ok, withErrorHandling } from "@/lib/errors/respond";
import { decideLeaveRequest } from "@/lib/leave/decide";
import { decisionSchema, requestIdSchema } from "@/lib/leave/schemas";
import { requireDb } from "@/lib/leave/service";

export const dynamic = "force-dynamic";
/** No request may run for the platform default of 300 s: a hang fails fast and is logged. */
export const maxDuration = 30;

type Context = { params: Promise<{ id: string }> };

/**
 * US-03 — approve or reject one pending request. Managers only (EPIC-10): an HR admin has no team
 * and decides over-balance requests through the override route. `decideLeaveRequest` checks the
 * decider's role again, and the real scope is in SQL (the request must belong to one of the
 * caller's direct reports), so a request from another team is a 403. The decider is always the
 * session user, never a value from the body.
 */
export const POST = withErrorHandling<Context>(async (request, context) => {
  const session = await assertRole("employee", "manager", "hr_admin");
  if (!canApproveLeave(session.role)) throw new AppError("FORBIDDEN", APPROVERS_ONLY_MESSAGE);
  const { id } = await context.params;
  const requestId = requestIdSchema.parse(id);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const input = decisionSchema.parse(body);

  return ok(await decideLeaveRequest(requireDb(), session.user.id, requestId, input));
});
