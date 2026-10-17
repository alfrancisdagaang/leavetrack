import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { supabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { fetchWithDeadline } from "@/lib/supabase/fetch";

/**
 * Supabase Auth client bound to the request cookies. Returns null when the project URL or
 * anon key is not configured, so callers fail closed (no session) instead of throwing.
 */
export async function createSupabaseServerClient() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey } = getEnv();
  if (!url || !anonKey) return null;

  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    global: { fetch: fetchWithDeadline("auth.get_user") },
    cookieOptions: supabaseCookieOptions(),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        // Server components cannot write cookies. Refreshing the session cookies is the
        // proxy's job (TASK-021); a failed write here is expected and safe to ignore.
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          /* read-only cookie store */
        }
      },
    },
  });
}
