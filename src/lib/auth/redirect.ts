/**
 * Sanitizes a post-login `next` target to a same-site path (prevents open redirects).
 * Anything not starting with a single "/" — or pointing back at /login — falls back to /dashboard.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  if (next.includes("\\") || next === "/login" || next.startsWith("/login?")) return "/dashboard";
  return next;
}
