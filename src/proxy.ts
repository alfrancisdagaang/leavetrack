import { NextResponse, type NextRequest } from "next/server";
import { verifyCronSecret } from "@/lib/auth/cron";
import { parseRole, SESSION_COOKIE } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";
import { failure } from "@/lib/errors/respond";

const PUBLIC_PATHS = new Set(["/login", "/api/health"]);

/**
 * Route guard (Next.js 16 `proxy`, formerly middleware).
 * - /api/health          → public
 * - /api/jobs/*          → requires `Authorization: Bearer $CRON_SECRET` (cookie ignored)
 * - /login               → public; redirects to /dashboard if already signed in
 * - other /api/*         → 401 JSON envelope without a valid session
 * - everything else      → redirect to /login?next=… without a valid session
 * A cookie holding an unknown role counts as no session and is cleared.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/jobs/")) {
    const authorized = verifyCronSecret(request.headers.get("authorization"), getEnv().CRON_SECRET);
    return authorized ? NextResponse.next() : failure("UNAUTHORIZED", "Invalid cron credentials.");
  }

  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value;
  const role = parseRole(cookieValue);
  const withClearedCookie = (response: NextResponse) => {
    if (cookieValue !== undefined && !role) response.cookies.delete(SESSION_COOKIE);
    return response;
  };

  if (pathname === "/login" && role) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (PUBLIC_PATHS.has(pathname) || role) {
    return withClearedCookie(NextResponse.next());
  }

  if (pathname.startsWith("/api/")) {
    return withClearedCookie(failure("UNAUTHORIZED", "Authentication required."));
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return withClearedCookie(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
