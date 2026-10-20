import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-schema";

// Supabase error codes that mean "these credentials do not work", whatever the reason (same set
// as the sign-in action). One generic answer, so nothing about the account is revealed.
const CREDENTIAL_ERROR_CODES = new Set(["invalid_credentials", "user_not_found"]);

const UNAVAILABLE = "Password change is unavailable right now. Try again shortly.";

/**
 * Changes the signed-in person's own password (TASK-065). Order matters:
 *  1. sign the session's own email in again with the current password, so a stolen or left-open
 *     session alone cannot change it;
 *  2. set the new password;
 *  3. sign out every OTHER session (this one stays). Best effort: the password is already changed.
 * `email` comes from the session, never from the request. No password is logged or returned.
 */
export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    logger.error("Password change attempted but Supabase is not configured");
    throw new AppError("SERVICE_UNAVAILABLE", UNAVAILABLE);
  }

  const signIn = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (signIn.error) {
    if (CREDENTIAL_ERROR_CODES.has(signIn.error.code ?? "")) {
      throw new AppError("VALIDATION_ERROR", "Your current password is incorrect.");
    }
    logger.warn(
      { code: signIn.error.code, status: signIn.error.status },
      "Password change: re-check failed upstream",
    );
    throw new AppError("SERVICE_UNAVAILABLE", UNAVAILABLE);
  }

  const update = await supabase.auth.updateUser({ password: newPassword });
  if (update.error) {
    if (update.error.code === "weak_password") {
      throw new AppError(
        "VALIDATION_ERROR",
        `New password is too weak. Use at least ${PASSWORD_MIN_LENGTH} characters and avoid common passwords.`,
      );
    }
    if (update.error.code === "same_password") {
      throw new AppError(
        "VALIDATION_ERROR",
        "The new password must be different from the current one.",
      );
    }
    logger.warn(
      { code: update.error.code, status: update.error.status },
      "Password change: update failed upstream",
    );
    throw new AppError("SERVICE_UNAVAILABLE", UNAVAILABLE);
  }

  const out = await supabase.auth.signOut({ scope: "others" });
  if (out.error) {
    logger.warn(
      { code: out.error.code, status: out.error.status },
      "Password changed but other sessions were not signed out",
    );
  }
}
