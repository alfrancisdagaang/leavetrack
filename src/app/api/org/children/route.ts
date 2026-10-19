import { assertRole } from "@/lib/auth/guards";
import { timedRead } from "@/lib/db/timed";
import { ok, withErrorHandling } from "@/lib/errors/respond";
import { getOrgChildren } from "@/lib/leave/org";
import { orgChildrenQuerySchema } from "@/lib/leave/org-schema";
import { requireDb } from "@/lib/leave/service";

export const dynamic = "force-dynamic";
/** No request may run for the platform default of 300 s: a hang fails fast and is logged. */
export const maxDuration = 30;

/**
 * EPIC-11 (TASK-063) — one page (50) of a person's direct reports, for HR expanding a node of the
 * organization chart. HR Admin only. Not scoped to a team: HR's scope is the whole company (a documented
 * exception to AGENTS.md rule 3, like the override and audit routes). `parent` names the person being
 * opened, never the caller: the viewer is always the session user, and `getOrgChildren` checks the role
 * again in its SQL, so `assertRole` is only the first gate. Read-only and per person, so never cached.
 * Only id, name, role and the number of reports leave here: no email, no leave data.
 */
export const GET = withErrorHandling(async (request) => {
  const session = await assertRole("hr_admin");
  const { searchParams } = new URL(request.url);
  const query = orgChildrenQuerySchema.parse({
    parent: searchParams.get("parent") ?? undefined,
    page: searchParams.get("page") ?? undefined,
  });

  const data = await timedRead("api.org_children", () =>
    getOrgChildren(requireDb(), {
      viewerId: session.user.id,
      parentId: query.parent,
      page: query.page,
    }),
  );
  return ok(data, { headers: { "cache-control": "no-store" } });
});
