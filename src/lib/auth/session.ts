/**
 * Session resolution (ADR-LeaveTrack-E003). Supabase Auth proves who the person is; the
 * `users` row found by lower(email) says what they may do. The `mock-role` cookie is only a
 * labelled fallback, honoured when ALLOW_MOCK_LOGIN is true (ADR-LeaveTrack-E001).
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { findUserByEmail } from "@/lib/auth/users";
import { getDb } from "@/lib/db/client";
import { timedRead } from "@/lib/db/timed";
import { withDeadline } from "@/lib/supabase/fetch";
import { parseRole, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/mock-cookie";
import type { User, UserRole } from "@/lib/db/types";
import { AppError } from "@/lib/errors/app-error";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { MOCK_USER_BY_ROLE } from "@/lib/mock/users";
import { isSecureCookie } from "@/lib/supabase/cookie-options";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export { parseRole, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS };

export type Session = { role: UserRole; user: User };

/** Options for the mock-role cookie. Secure follows the shared rule in `isSecureCookie`. */
export function sessionCookieOptions(appEnv: string, nodeEnv = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureCookie(appEnv, nodeEnv),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** The signed-in person from Supabase Auth, resolved to their `users` row. Null means no session. */
async function sessionFromSupabase(): Promise<Session | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  // getUser() asks the Auth server to validate the token; the cookie contents alone are not trusted.
  const { data, error } = await withDeadline("auth.get_user", () => supabase.auth.getUser());
  // The Auth server being unreachable is not "signed out": say so instead of bouncing to /login.
  if (error && isAuthRetryableFetchError(error)) throw error;
  const email = data.user?.email;
  if (error || !email) return null;

  const sql = getDb();
  if (!sql) {
    logger.warn("Signed-in account cannot be resolved: database not configured");
    return null;
  }
  const user = await timedRead("session.find_user", () => findUserByEmail(sql, email));
  if (!user) {
    logger.warn({ authUserId: data.user.id }, "Signed-in account has no users row");
    return null;
  }
  return { role: user.role, user };
}

/** The labelled mock fallback: honoured only when ALLOW_MOCK_LOGIN is true. */
async function sessionFromMockCookie(): Promise<Session | null> {
  if (!getEnv().ALLOW_MOCK_LOGIN) return null;
  const role = parseRole((await cookies()).get(SESSION_COOKIE)?.value);
  return role ? { role, user: MOCK_USER_BY_ROLE[role] } : null;
}

/** Where a session came from: a real Supabase account, or the labelled mock cookie. */
export type SessionSource = "supabase" | "mock";

type Resolved = { session: Session; source: SessionSource } | null;

const resolveSession = cache(async (): Promise<Resolved> => {
  try {
    const real = await sessionFromSupabase();
    if (real) return { session: real, source: "supabase" };
    const mock = await sessionFromMockCookie();
    return mock ? { session: mock, source: "mock" } : null;
  } catch (err) {
    // Next signals "this render is dynamic" and redirects by throwing; those must pass through.
    unstable_rethrow(err);
    // Could not check (database or Auth outage). Never treated as signed in, and not as signed
    // out either: the caller shows "unavailable" so a blip does not look like a logout.
    logger.error({ err }, "Session resolution failed");
    throw new AppError(
      "SERVICE_UNAVAILABLE",
      "Sign-in is temporarily unavailable. Try again shortly.",
      { cause: err },
    );
  }
});

/** Current session for server components, actions, and route handlers. */
export async function getSession(): Promise<Session | null> {
  return (await resolveSession())?.session ?? null;
}

/**
 * Where the current session came from, from the same cached resolution as `getSession()` (no
 * second lookup). Null means no session. Only for features a mock session cannot use, such as
 * changing a password (a mock user has no Supabase account); it grants nothing.
 */
export async function getSessionSource(): Promise<SessionSource | null> {
  return (await resolveSession())?.source ?? null;
}
