import { logger } from "@/lib/logger";

/** A query slower than this is logged as a warning, so a stall shows up before it times out. */
export const SLOW_QUERY_MS = 2000;

/**
 * Runs a database call and logs how long it took, under a fixed name. A slow call logs a warning;
 * a failed one logs the error code (e.g. 57014 = statement timeout) and rethrows unchanged. Only
 * the name is logged: never SQL text, parameters or row data (AGENTS.md rule 8).
 */
export async function timedQuery<T>(name: string, run: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    const result = await run();
    const ms = Date.now() - started;
    if (ms >= SLOW_QUERY_MS) logger.warn({ query: name, ms }, "Slow database query");
    return result;
  } catch (err) {
    const code = (err as { code?: unknown } | null)?.code;
    logger.error(
      { query: name, ms: Date.now() - started, code: typeof code === "string" ? code : undefined },
      "Database query failed",
    );
    throw err;
  }
}
