import { USER_ROLES, type UserRole } from "@/lib/db/types";

/**
 * The labelled mock-login cookie (ADR-LeaveTrack-E001). Kept free of server-only imports so the
 * proxy can read it without bundling the database client or Supabase.
 */
export const SESSION_COOKIE = "mock-role";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** Returns the role if the cookie value is a known role, otherwise null (treated as no session). */
export function parseRole(value: string | undefined): UserRole | null {
  return (USER_ROLES as readonly string[]).includes(value ?? "") ? (value as UserRole) : null;
}
