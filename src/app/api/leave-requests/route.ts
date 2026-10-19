import { assertRole } from "@/lib/auth/guards";
import { canRequestLeave, EMPLOYEES_ONLY_MESSAGE } from "@/lib/auth/roles";
import { timedRead } from "@/lib/db/timed";
import { AppError } from "@/lib/errors/app-error";
import { ok, withErrorHandling } from "@/lib/errors/respond";
import { createLeaveRequestSchema, listQuerySchema } from "@/lib/leave/schemas";
import { createLeaveRequest, getMySummary, requireDb } from "@/lib/leave/service";
import { getTeamQueue } from "@/lib/leave/team";

export const dynamic = "force-dynamic";
/** No request may run for the platform default of 300 s: a hang fails fast and is logged. */
export const maxDuration = 30;

/**
 * US-01 — submit a leave request. Employees only (EPIC-10); `createLeaveRequest` checks the role
 * again against the users row, so this gate is not the only one.
 */
export const POST = withErrorHandling(async (request) => {
  const session = await assertRole("employee", "manager", "hr_admin");
  if (!canRequestLeave(session.role)) throw new AppError("FORBIDDEN", EMPLOYEES_ONLY_MESSAGE);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const input = createLeaveRequestSchema.parse(body);

  // The requester is always the session user — never an id from the body.
  const result = await createLeaveRequest(requireDb(), session.user.id, input);
  return ok(result, { status: 201 });
});

/**
 * US-02 (`scope=mine`, employees only: managers and HR admins have no requests or balances of
 * their own) and US-04 (`scope=team`, managers only: an HR admin has no team).
 * The team queue is scoped in SQL to the session user's direct reports; no client id is read.
 */
export const GET = withErrorHandling(async (request) => {
  const session = await assertRole("employee", "manager", "hr_admin");
  const { searchParams } = new URL(request.url);
  const { scope } = listQuerySchema.parse({ scope: searchParams.get("scope") ?? undefined });

  if (scope === "team") {
    await assertRole("manager");
    return ok({
      requests: await timedRead("api.team_queue", () => getTeamQueue(requireDb(), session.user.id)),
    });
  }
  if (!canRequestLeave(session.role)) throw new AppError("FORBIDDEN", EMPLOYEES_ONLY_MESSAGE);
  return ok(await timedRead("api.my_summary", () => getMySummary(requireDb(), session.user.id)));
});
