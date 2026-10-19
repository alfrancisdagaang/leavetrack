import { assertRole } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors/app-error";
import { ok, withErrorHandling } from "@/lib/errors/respond";
import { markNotificationsRead } from "@/lib/leave/notifications";
import { markReadSchema } from "@/lib/leave/schemas";
import { requireDb } from "@/lib/leave/service";

export const dynamic = "force-dynamic";
/** No request may run for the platform default of 300 s: a hang fails fast and is logged. */
export const maxDuration = 30;

/**
 * TASK-054 (EPIC-9) — mark the signed-in person's notifications read: every unread one, or the one
 * `id` in the body. A write, so a route handler (AGENTS.md rule 11), and not retried. The recipient
 * is always the session user; a foreign or unknown id changes nothing and looks like an already-read
 * one. An empty body means "mark all".
 */
export const POST = withErrorHandling(async (request) => {
  const session = await assertRole("employee", "manager", "hr_admin");

  const text = await request.text();
  let body: unknown = {};
  if (text.trim() !== "") {
    try {
      body = JSON.parse(text);
    } catch {
      throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
    }
  }
  const input = markReadSchema.parse(body);

  return ok(await markNotificationsRead(requireDb(), session.user.id, input.id));
});
