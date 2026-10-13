/**
 * ⚠ MOCK AUTH — Day 0 only (ADR-LeaveTrack-E001). Never ship past scaffold.
 * The cookie holds only a role; any login input is accepted. Day 1 replaces how the
 * cookie gets set (real provider) — the cookie shape, proxy guard, and getSession()
 * contract stay the same.
 */
import { cookies } from "next/headers";
import { USER_ROLES, type User, type UserRole } from "@/lib/db/types";
import { MOCK_USER_BY_ROLE } from "@/lib/mock/users";

export const SESSION_COOKIE = "mock-role";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export type Session = { role: UserRole; user: User };

/** Returns the role if the cookie value is a known role, otherwise null (treated as no session). */
export function parseRole(value: string | undefined): UserRole | null {
  return (USER_ROLES as readonly string[]).includes(value ?? "") ? (value as UserRole) : null;
}

/** Secure unless running locally in dev — a production build is always Secure, even if APP_ENV is unset. */
export function sessionCookieOptions(appEnv: string, nodeEnv = process.env.NODE_ENV) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: appEnv !== "development" || nodeEnv === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/** Current session for server components, actions, and route handlers. */
export async function getSession(): Promise<Session | null> {
  const role = parseRole((await cookies()).get(SESSION_COOKIE)?.value);
  return role ? { role, user: MOCK_USER_BY_ROLE[role] } : null;
}
