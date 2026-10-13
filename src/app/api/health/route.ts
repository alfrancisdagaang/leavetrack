import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";
import { ok, withErrorHandling } from "@/lib/errors/respond";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

type DbStatus = "ok" | "error" | "not_configured";

async function checkDb(): Promise<DbStatus> {
  const sql = getDb();
  if (!sql) return "not_configured";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      sql`select 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("db ping timeout")), 1000);
      }),
    ]);
    return "ok";
  } catch (err) {
    logger.warn({ err }, "Health check: database ping failed");
    return "error";
  } finally {
    clearTimeout(timer);
  }
}

/** Public liveness/readiness probe. Always 200 so Day 0 runs without a database. */
export const GET = withErrorHandling(async () => {
  return ok({ status: "ok", env: getEnv().APP_ENV, db: await checkDb() });
});
