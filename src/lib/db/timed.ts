import { AppError } from "@/lib/errors/app-error";
import { logger } from "@/lib/logger";

/** A query slower than this is logged as a warning, so a stall shows up before it times out. */
export const SLOW_QUERY_MS = 2000;

/** A query still unanswered after this is treated as hung and fails with SERVICE_UNAVAILABLE. */
export const QUERY_DEADLINE_MS = 8000;

/**
 * A read gets this long on its first attempt. Healthy queries take milliseconds, so a longer wait
 * means the connection is dead or stuck; one retry then costs about this much instead of the
 * full deadline. The retry gets whatever is left of QUERY_DEADLINE_MS, so the total is unchanged.
 */
export const READ_FIRST_ATTEMPT_MS = 3000;

/** postgres.js error codes for a connection that went away (as opposed to a query that failed). */
const CONNECTION_ERROR_CODES = new Set([
  "ECONNRESET",
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECT_TIMEOUT",
]);

/** The errors timedQuery raised for a missed deadline, so a retry can tell them from other 503s. */
const deadlineErrors = new WeakSet<object>();

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
      const err = new AppError("SERVICE_UNAVAILABLE", "The database did not answer in time.");
      deadlineErrors.add(err);
      reject(err);
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

function isRetryable(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if (deadlineErrors.has(err)) return true;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" && CONNECTION_ERROR_CODES.has(code);
}

/**
 * timedQuery for READ queries only. A first attempt that misses READ_FIRST_ATTEMPT_MS, or fails
 * because its connection went away, is run once more with the rest of the deadline. The abandoned
 * first query is not cancelled and keeps its pooled connection busy, so the retry is served by a
 * different connection. `run` is called twice, so it must have no side effects: never pass a
 * write here (writes use sql.begin and are deliberately not retried).
 */
export async function timedRead<T>(
  name: string,
  run: () => Promise<T>,
  deadlineMs: number = QUERY_DEADLINE_MS,
): Promise<T> {
  const started = Date.now();
  try {
    return await timedQuery(name, run, Math.min(READ_FIRST_ATTEMPT_MS, deadlineMs));
  } catch (err) {
    if (!isRetryable(err)) throw err;
    const remaining = deadlineMs - (Date.now() - started);
    if (remaining <= 0) throw err;
    logger.warn({ query: name, attempt: 2, remainingMs: remaining }, "Retrying read query");
    return timedQuery(name, run, remaining);
  }
}
