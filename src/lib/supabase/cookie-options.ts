import type { CookieOptions } from "@supabase/ssr";
import { getEnv } from "@/lib/env";

/**
 * Secure unless running locally in dev: a production build is always Secure, even if APP_ENV is
 * unset or left at "development". One rule for every cookie this app sets.
 */
export function isSecureCookie(appEnv: string, nodeEnv = process.env.NODE_ENV): boolean {
  return appEnv !== "development" || nodeEnv === "production";
}

/**
 * Options for the Supabase Auth session cookies (`sb-*-auth-token`). @supabase/ssr defaults to
 * `httpOnly: false` and no `Secure` because its browser client must read the cookie. This app
 * has no browser client (every Auth call is server-side), so the cookie is hidden from scripts:
 * a cross-site-scripting bug then cannot steal the session. Passed as `cookieOptions`, which the
 * library merges over its defaults. `maxAge` is left to the library.
 */
export function supabaseCookieOptions(
  appEnv: string = getEnv().APP_ENV,
  nodeEnv = process.env.NODE_ENV,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecureCookie(appEnv, nodeEnv),
  };
}
