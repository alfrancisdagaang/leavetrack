import type { Sql } from "postgres";

/** Shown when a person has no manager (the top of the tree): HR reviews their requests. */
export const HR_REVIEWER = "HR";

/**
 * Who reviews the signed-in user's leave, for the Request leave page's "Reviewer" row. The user is
 * the SESSION user (never a client-supplied id) and the manager comes from `users.manager_id`, in
 * the query itself (AGENTS.md rule 3). No manager, or no such user, reads as "HR".
 */
export async function getReviewerName(sql: Sql, userId: string): Promise<string> {
  const rows = await sql<{ manager_name: string | null }[]>`
    select m.name as manager_name
    from public.users u
    left join public.users m on m.id = u.manager_id
    where u.id = ${userId}`;
  return rows[0]?.manager_name ?? HR_REVIEWER;
}
