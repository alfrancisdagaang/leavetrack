import { assertRole } from "@/lib/auth/guards";
import { ok, withErrorHandling } from "@/lib/errors/respond";
import { getAuditHistory } from "@/lib/leave/audit";
import { auditQuerySchema, requestIdSchema } from "@/lib/leave/schemas";
import { requireDb } from "@/lib/leave/service";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ userId: string }> };

/**
 * US-05 — HR's decision history for one employee. HR admins only, and deliberately not limited to
 * direct reports ("any employee ID"): the role gate is the control. `userId` names the employee
 * being looked up, never the caller. Read-only; soft-deleted requests are hidden unless
 * `include_deleted=true`, and nothing is ever purged.
 */
export const GET = withErrorHandling<Context>(async (request, context) => {
  await assertRole("hr_admin");
  const userId = requestIdSchema.parse((await context.params).userId);
  const { searchParams } = new URL(request.url);
  const query = auditQuerySchema.parse({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    include_deleted: searchParams.get("include_deleted") ?? undefined,
  });

  const history = await getAuditHistory(requireDb(), userId, query);
  return ok({ ...history, filters: query });
});
