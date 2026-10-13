import { redirect } from "next/navigation";
import type { UserRole } from "@/lib/db/types";
import { AppError } from "@/lib/errors/app-error";
import { getSession, type Session } from "@/lib/auth/session";

/** Pages / server actions: redirect to /login when there is no session. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Pages / server actions: require one of `roles`. Unauthenticated → /login;
 * wrong role → /dashboard (no information about the protected page is rendered).
 */
export async function requireRole(...roles: UserRole[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect("/dashboard");
  return session;
}

/**
 * Route handlers (inside withErrorHandling): throws AppError so the response uses the
 * standard envelope — 401 with no session, 403 with the wrong role.
 * Role checks are coarse-grained only; row-level scoping (e.g. manager_id) belongs in SQL.
 */
export async function assertRole(...roles: UserRole[]): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AppError("UNAUTHORIZED", "Authentication required.");
  if (!roles.includes(session.role)) {
    throw new AppError("FORBIDDEN", "You do not have access to this resource.");
  }
  return session;
}
