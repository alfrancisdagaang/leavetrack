import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger";

/** A query slower than this is logged as a warning, so a stall shows up before it times out. */
export const SLOW_QUERY_MS = 2000;

/** A query still unanswered after this is treated as hung and fails with SERVICE_UNAVAILABLE. */
export const QUERY_DEADLINE_MS = 8000;

/**
 * Runs a database call and logs how long it took, under a fixed name. A slow call logs a warning;
 * a failed one logs the error code (e.g. 57014 = statement timeout) and rethrows unchanged; one
 * that never answers is abandoned at `deadlineMs`. The abandoned query is NOT cancelled on the
 * server: it may keep its connection busy until the database or pooler gives up. Only the name is
 * logged: never SQL text, parameters or row data (AGENTS.md rule 8).
 */
export async function timedQuery<T>(
  name: string,
  run: () => Promise<T>,
  deadlineMs: number = QUERY_DEADLINE_MS,
): Promise<T> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const call = run();
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      // A late rejection of the abandoned query must not surface as an unhandled rejection.
      call.catch(() => undefined);
      reject(new AppError("SERVICE_UNAVAILABLE", "The database did not answer in time."));
    }, deadlineMs);
  });

  try {
    const result = await Promise.race([call, deadline]);
    const ms = Date.now() - started;
    if (ms >= SLOW_QUERY_MS) logger.warn({ query: name, ms }, "Slow database query");
    return result;
  } catch (err) {
    const ms = Date.now() - started;
    if (err instanceof AppError && err.code === "SERVICE_UNAVAILABLE" && ms >= deadlineMs) {
      logger.error({ query: name, ms, deadlineMs }, "Database query hit its deadline");
    } else if (err instanceof AppError) {
      // An expected, client-safe failure (e.g. NOT_FOUND): not a database fault, so not logged here.
    } else {
      const code = (err as { code?: unknown } | null)?.code;
      logger.error(
        { query: name, ms, code: typeof code === "string" ? code : undefined },
        "Database query failed",
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
