// Pure logic for scripts/seed-auth-users.ts (TASK-024). No I/O here, so it can be unit tested.

export const MIN_PASSWORD_LENGTH = 8;
const LIST_PAGE_SIZE = 200;
const MAX_PAGES = 50;

/** The slice of supabase-js `auth.admin` this script uses; tests supply a stub. */
export interface AdminApi {
  listUsers(params: { page: number; perPage: number }): Promise<{
    data: { users: { id: string; email?: string }[] } | { users: [] };
    error: { message: string; code?: string } | null;
  }>;
  createUser(attrs: { email: string; password: string; email_confirm: boolean }): Promise<{
    error: { message: string; code?: string } | null;
  }>;
  updateUserById(
    id: string,
    attrs: { password: string; email_confirm: boolean },
  ): Promise<{ error: { message: string; code?: string } | null }>;
}

/** Emails from the `insert into public.users` block of supabase/seed.sql, in file order. */
export function parseSeedEmails(sql: string): string[] {
  const block = /insert\s+into\s+public\.users\b[\s\S]*?\bon\s+conflict\b/i.exec(sql);
  if (!block) throw new Error("seed.sql has no insert into public.users block");
  const emails = [...block[0].matchAll(/'([^'\s]+@[^'\s]+)'/g)].map((m) => m[1]!.toLowerCase());
  const unique = [...new Set(emails)];
  if (unique.length === 0) throw new Error("seed.sql users block has no emails");
  return unique;
}

export interface ScriptInputs {
  url: string;
  serviceRoleKey: string;
  password: string;
  anonKey: string | null;
}

/** Reads and checks the run-time inputs. Error messages never contain the key or password. */
export function validateInputs(env: Record<string, string | undefined>): ScriptInputs {
  const url = env.SUPABASE_URL?.trim() ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const password = env.DEMO_PASSWORD ?? "";
  const anonKey = env.SUPABASE_ANON_KEY?.trim() || null;

  const missing = [
    ["SUPABASE_URL", url],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
    ["DEMO_PASSWORD", password],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) throw new Error(`Missing in your shell: ${missing.join(", ")}`);

  const hosted = /^https:\/\/[a-z0-9]{10,}\.supabase\.co\/?$/.test(url);
  const local = /^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(url);
  if (!hosted && !local) {
    throw new Error("SUPABASE_URL must look like https://<project-ref>.supabase.co");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`DEMO_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return { url: url.replace(/\/$/, ""), serviceRoleKey, password, anonKey };
}

export type AccountResult = "created" | "updated";

/** Finds the account by case-insensitive email; creates it confirmed, or resets its password. */
export async function ensureAccount(
  admin: AdminApi,
  email: string,
  password: string,
): Promise<AccountResult> {
  const wanted = email.toLowerCase();
  let existingId: string | null = null;

  for (let page = 1; page <= MAX_PAGES && existingId === null; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: LIST_PAGE_SIZE });
    if (error) throw new Error(`Could not list accounts: ${error.code ?? error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === wanted);
    if (found) existingId = found.id;
    if (data.users.length < LIST_PAGE_SIZE) break;
  }

  if (existingId === null) {
    const { error } = await admin.createUser({ email: wanted, password, email_confirm: true });
    if (error) throw new Error(`Could not create ${wanted}: ${error.code ?? error.message}`);
    return "created";
  }
  const { error } = await admin.updateUserById(existingId, { password, email_confirm: true });
  if (error) throw new Error(`Could not update ${wanted}: ${error.code ?? error.message}`);
  return "updated";
}
