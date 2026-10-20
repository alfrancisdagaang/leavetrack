import { assertRole } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors/app-error";
import { ok, withErrorHandling } from "@/lib/errors/respond";
import { setPolicyRate } from "@/lib/leave/policies";
import { rateText, setPolicyRateSchema } from "@/lib/leave/policies-schema";
import { requireDb } from "@/lib/leave/service";

export const dynamic = "force-dynamic";
/** No request may run for the platform default of 300 s: a hang fails fast and is logged. */
export const maxDuration = 30;

/**
 * EPIC-13 (TASK-071) — HR Admin sets one employee's accrual rate for one leave type. A write, so a route
 * handler (AGENTS.md rule 11), and not retried. HR Admin only. Not scoped to a team: HR's scope is the
 * whole company (a documented exception to rule 3, like the override and org routes). The actor is
 * always the session user and `setPolicyRate` checks the role again in its SQL, so `assertRole` is only
 * the first gate; `user_id` and `leave_type_id` are lookup keys, never an identity. The change and its
 * record are written together. It applies from the next monthly accrual.
 */
export const PUT = withErrorHandling(async (request) => {
  const session = await assertRole("hr_admin");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const input = setPolicyRateSchema.parse(body);

  const result = await setPolicyRate(requireDb(), {
    actorId: session.user.id,
    userId: input.user_id,
    leaveTypeId: input.leave_type_id,
    rate: rateText(input.accrual_per_month),
  });
  return ok(result, { headers: { "cache-control": "no-store" } });
});
