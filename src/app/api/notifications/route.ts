import { assertRole } from "@/lib/auth/guards";
import { timedRead } from "@/lib/db/timed";
import { ok, withErrorHandling } from "@/lib/errors/respond";
import { listNotifications } from "@/lib/leave/notifications";
import { requireDb } from "@/lib/leave/service";

export const dynamic = "force-dynamic";
/** No request may run for the platform default of 300 s: a hang fails fast and is logged. */
export const maxDuration = 30;

/**
 * TASK-054 (EPIC-9) — the signed-in person's latest notifications and unread count. Any role: the
 * scope is the recipient, not the role, and it is in the SQL (`recipient_id` = the session user).
 * No client value is read, so there is no id to tamper with. The data is per person, so it is never
 * cached.
 */
export const GET = withErrorHandling(async () => {
  const session = await assertRole("employee", "manager", "hr_admin");
  const data = await timedRead("api.notifications", () =>
    listNotifications(requireDb(), session.user.id),
  );
  return ok(data, { headers: { "cache-control": "no-store" } });
});
