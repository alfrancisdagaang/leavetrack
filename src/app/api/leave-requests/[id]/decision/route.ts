import { assertRole } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors/app-error";
import { ok, withErrorHandling } from "@/lib/errors/respond";
import { decideLeaveRequest } from "@/lib/leave/decide";
import { decisionSchema, requestIdSchema } from "@/lib/leave/schemas";
import { requireDb } from "@/lib/leave/service";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * US-03 — approve or reject one pending request. Managers and HR admins only; the real gate is
 * in SQL (the request must belong to one of the caller's direct reports), so a request from
 * another team is a 403. The decider is always the session user, never a value from the body.
 */
export const POST = withErrorHandling<Context>(async (request, context) => {
  const session = await assertRole("manager", "hr_admin");
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
