import { assertRole } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors/app-error";
import { ok, withErrorHandling } from "@/lib/errors/respond";
import { createLeaveRequestSchema, listQuerySchema } from "@/lib/leave/schemas";
import { createLeaveRequest, getMySummary, requireDb } from "@/lib/leave/service";

export const dynamic = "force-dynamic";

/** US-01 — submit a leave request. Roles stack, so every role may request leave for themselves. */
export const POST = withErrorHandling(async (request) => {
  const session = await assertRole("employee", "manager", "hr_admin");

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

/** US-02 — the caller's own requests and balances. `scope=team` arrives with TASK-013. */
export const GET = withErrorHandling(async (request) => {
  const session = await assertRole("employee", "manager", "hr_admin");
  const { searchParams } = new URL(request.url);
  listQuerySchema.parse({ scope: searchParams.get("scope") ?? undefined });

  return ok(await getMySummary(requireDb(), session.user.id));
});
