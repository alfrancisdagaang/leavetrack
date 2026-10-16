import { NextResponse, type NextRequest } from "next/server";
import { verifyCronSecret } from "@/lib/auth/cron";
import { parseRole, SESSION_COOKIE } from "@/lib/auth/mock-cookie";
import { getEnv } from "@/lib/env";
import { failure } from "@/lib/errors/respond";
import { refreshSupabaseSession } from "@/lib/supabase/proxy";

const PUBLIC_PATHS = new Set(["/login", "/api/health"]);

/**
 * Route guard (Next.js 16 `proxy`, formerly middleware).
 * - /api/health          → public
 * - /api/jobs/*          → requires `Authorization: Bearer $CRON_SECRET` (cookie ignored)
 * - /login               → public; the page itself sends people with a real session on to the app
 * - other /api/*         → 401 JSON envelope without a valid session
 * - everything else      → redirect to /login?next=… without a valid session
 * A valid session is a Supabase session (its cookies are refreshed here) or, only while
 * ALLOW_MOCK_LOGIN is true, a `mock-role` cookie. This gate checks identity only; the role
 * and the `users` row come from getSession() (ADR-LeaveTrack-E003). With the flag off a
 * leftover mock cookie grants nothing and is cleared.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/jobs/")) {
    const authorized = verifyCronSecret(request.headers.get("authorization"), getEnv().CRON_SECRET);
    return authorized ? NextResponse.next() : failure("UNAUTHORIZED", "Invalid cron credentials.");
  }

  const supabase = await refreshSupabaseSession(request);
  const mockCookie = request.cookies.get(SESSION_COOKIE)?.value;
  const mockAllowed = getEnv().ALLOW_MOCK_LOGIN;
  const mockRole = mockAllowed ? parseRole(mockCookie) : null;
  const signedIn = Boolean(supabase?.signedIn) || mockRole !== null;

  const finish = (response: NextResponse) => {
    if (mockCookie !== undefined && !mockRole) response.cookies.delete(SESSION_COOKIE);
    return supabase ? supabase.withCookies(response) : response;
  };

  if (PUBLIC_PATHS.has(pathname) || signedIn) {
    return finish(NextResponse.next({ request }));
  }

  if (pathname.startsWith("/api/")) {
    return finish(failure("UNAUTHORIZED", "Authentication required."));
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return finish(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
