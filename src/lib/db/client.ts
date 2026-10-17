import postgres from "postgres";
import { getEnv } from "@/lib/env";

let sql: postgres.Sql | undefined;

/**
 * Shared Postgres client over the Supabase **pooler** (Supavisor, transaction mode).
 * - `prepare: false` is required in transaction mode (no session-level prepared statements).
 * - Created lazily so builds and Day 0 dev never need a database.
 * Returns undefined when DATABASE_URL is not configured.
 *
 * Always use tagged templates (sql`... ${value}`) — never string-concatenate SQL.
 */
export function getDb(): postgres.Sql | undefined {
  const { DATABASE_URL } = getEnv();
  if (!DATABASE_URL) return undefined;
  sql ??= postgres(DATABASE_URL, {
    prepare: false,
    max: 5,
    // Drop idle sockets quickly and retire old ones: the pooler closes connections a frozen
    // serverless function never noticed, and a dead socket only shows up as a stalled query.
    // Best effort; timedRead's retry is what covers a socket that is already dead.
    idle_timeout: 10,
    max_lifetime: 300,
    connect_timeout: 5,
  });
  return sql;
}
