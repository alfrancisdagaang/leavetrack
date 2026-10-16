"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNextPath } from "@/lib/auth/redirect";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/users";
import { getDb } from "@/lib/db/client";
import { USER_ROLES } from "@/lib/db/types";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null };

const MESSAGES = {
  missing: "Enter your email and password.",
  // One message for a wrong password and an unknown email, so account existence is not leaked.
  invalid: "Incorrect email or password.",
  notSetUp: "Your account is not set up. Ask HR.",
  unavailable: "Sign-in is unavailable right now. Try again shortly.",
} as const;

// Supabase error codes that mean "these credentials do not work", whatever the reason.
const CREDENTIAL_ERROR_CODES = new Set([
  "invalid_credentials",
  "user_not_found",
  "email_not_confirmed",
]);

const SignInSchema = z.object({
  email: z.string().trim().min(1).max(320),
  // Not trimmed: spaces can be part of a password.
  password: z.string().min(1).max(200),
  next: z.string().optional(),
});

/** Email and password sign-in through Supabase Auth (ADR-LeaveTrack-E003). */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = SignInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: MESSAGES.missing };
  const { email, password, next } = parsed.data;

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    logger.error("Sign-in attempted but Supabase is not configured");
    return { error: MESSAGES.unavailable };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user?.email) {
    if (error && !CREDENTIAL_ERROR_CODES.has(error.code ?? "")) {
      logger.warn({ code: error.code, status: error.status }, "Sign-in failed upstream");
      return { error: MESSAGES.unavailable };
    }
    return { error: MESSAGES.invalid };
  }

  // The Supabase account proves who they are; the users row says what they may do.
  const sql = getDb();
  const user = sql ? await findUserByEmail(sql, data.user.email) : null;
  if (!user) {
    await supabase.auth.signOut();
    if (!sql) {
      logger.error("Sign-in succeeded but the database is not configured");
      return { error: MESSAGES.unavailable };
    }
    logger.warn({ authUserId: data.user.id }, "Signed-in account has no users row");
    return { error: MESSAGES.notSetUp };
  }

  // A leftover mock cookie must not outlive a real sign-in.
  (await cookies()).delete(SESSION_COOKIE);
  logger.info({ userId: user.id, role: user.role }, "Signed in");
  redirect(safeNextPath(next));
}

const MockLoginSchema = z.object({
  // ⚠ MOCK AUTH: name/email are accepted as-is and never checked (ADR-LeaveTrack-E001).
  name: z.string().trim().max(200),
  email: z.string().trim().max(320),
  role: z.enum(USER_ROLES),
  next: z.string().optional(),
});

/** The labelled mock fallback. Refuses unless ALLOW_MOCK_LOGIN is true. */
export async function mockLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!getEnv().ALLOW_MOCK_LOGIN) return { error: "Mock sign-in is switched off." };

  const parsed = MockLoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose a valid role to continue." };

  (await cookies()).set(SESSION_COOKIE, parsed.data.role, sessionCookieOptions(getEnv().APP_ENV));
  logger.info({ role: parsed.data.role }, "Mock login");
  redirect(safeNextPath(parsed.data.next));
}

export async function logoutAction(): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase?.auth.signOut();
  } catch (err) {
    // Clear the local session anyway; an unreachable Auth server must not trap anyone signed in.
    logger.warn({ err }, "Supabase sign-out failed");
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
