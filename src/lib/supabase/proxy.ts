import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { fetchWithDeadline, withDeadline } from "@/lib/supabase/fetch";

export type ProxySupabaseSession = {
  /** True when the request carries a valid Supabase session (identity only; the users row is checked later). */
  signedIn: boolean;
  /** True when the check could not be completed (timeout or network failure), as opposed to "no session". */
  unavailable: boolean;
  /** Copies any refreshed session cookies onto the response the proxy returns. */
  withCookies: <T extends NextResponse>(response: T) => T;
};

type PendingCookie = { name: string; value: string; options: CookieOptions };

/**
 * Validates the Supabase session for a request and refreshes its cookies (the proxy is the
 * only place that can write them; ADR-LeaveTrack-E003). Returns null when Supabase is not
 * configured. Any failure counts as signed out — the proxy then fails closed.
 *
 * Refreshed cookies are also written onto the request so server components in the same
 * request read the fresh ones: refresh tokens are single-use, so a second refresh would fail.
 */
export async function refreshSupabaseSession(
  request: NextRequest,
): Promise<ProxySupabaseSession | null> {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey } = getEnv();
  if (!url || !anonKey) return null;

  const pending: PendingCookie[] = [];
  const pendingHeaders: Record<string, string> = {};
  const supabase = createServerClient(url, anonKey, {
    global: { fetch: fetchWithDeadline("proxy.get_claims") },
    cookieOptions: supabaseCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value, options } of toSet) {
          request.cookies.set(name, value);
          pending.push({ name, value, options });
        }
        Object.assign(pendingHeaders, headers);
      },
    },
  });

  let signedIn = false;
  let unavailable = false;
  try {
    const { data, error } = await withDeadline("proxy.get_claims", () => supabase.auth.getClaims());
    signedIn = !error && Boolean(data?.claims?.sub);
    unavailable = Boolean(error) && isAuthRetryableFetchError(error);
  } catch (err) {
    unavailable = true;
    logger.warn({ err }, "Supabase session check failed");
  }
  if (unavailable) logger.warn("Supabase session check unavailable; the page will re-check");

  return {
    signedIn,
    unavailable,
    withCookies: (response) => {
      for (const { name, value, options } of pending) response.cookies.set(name, value, options);
      for (const [key, value] of Object.entries(pendingHeaders)) response.headers.set(key, value);
      return response;
    },
  };
}
