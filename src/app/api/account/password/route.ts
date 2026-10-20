import { getSession, getSessionSource } from "@/lib/auth/session";
import { changePassword } from "@/lib/auth/change-password";
import { changePasswordSchema } from "@/lib/auth/password-schema";
import { AppError } from "@/lib/errors/app-error";
import { ok, withErrorHandling } from "@/lib/errors/respond";

export const dynamic = "force-dynamic";
/** No request may run for the platform default of 300 s: a hang fails fast and is logged. */
export const maxDuration = 30;

/**
 * TASK-065 (EPIC-11) — the signed-in person changes their OWN password. Goes through our server
 * because the CSP allows `connect-src 'self'` only. The account is the session's email, never a
 * value from the body. A mock-login session has no Supabase account and is refused. Any role may
 * call it. Passwords are never logged (`new_password` and friends are redacted) or returned.
 */
export const POST = withErrorHandling(async (request) => {
  const session = await getSession();
  if (!session) throw new AppError("UNAUTHORIZED", "Authentication required.");
  if ((await getSessionSource()) !== "supabase") {
    throw new AppError("FORBIDDEN", "Password change is not available with the demo login.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const input = changePasswordSchema.parse(body);

  await changePassword(session.user.email, input.current_password, input.new_password);
  return ok({ changed: true }, { headers: { "Cache-Control": "no-store" } });
});
