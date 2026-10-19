import type { Sql } from "postgres";
import type { UserRole } from "@/lib/db/types";

/**
 * What the Overview tab shows about the signed-in person: name, role, email and their manager's
 * name. ONE statement, scoped to the session user's own id in the SQL (never a client id). The
 * manager comes from a left join on `users.manager_id`, so someone at the top of the chart has
 * `managerName` null. Nothing about anyone else is returned beyond that one name.
 */
export type Profile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  managerName: string | null;
};

type Row = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  manager_name: string | null;
};

export async function getProfile(sql: Sql, userId: string): Promise<Profile | null> {
  const [row] = await sql<Row[]>`
    select u.id, u.name, u.email, u.role, m.name as manager_name
    from public.users u
    left join public.users m on m.id = u.manager_id
    where u.id = ${userId}::uuid
  `;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    managerName: row.manager_name,
  };
}
