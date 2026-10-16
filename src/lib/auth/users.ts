import type postgres from "postgres";
import type { User } from "@/lib/db/types";

/**
 * Resolves a signed-in email to its `users` row. The Supabase account proves who someone is;
 * this row says what they may do (ADR-LeaveTrack-E003). Case-insensitive in SQL, and the only
 * input is the session's own email — never a client-sent id.
 */
export async function findUserByEmail(sql: postgres.Sql, email: string): Promise<User | null> {
  const rows = await sql<User[]>`
    select id, name, email, role, manager_id
    from users
    where lower(email) = lower(${email})
    limit 1
  `;
  return rows[0] ?? null;
}
