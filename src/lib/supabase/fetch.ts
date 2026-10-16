import { logger } from "@/lib/logger";

/** How long a Supabase Auth call may take before it counts as hung (a normal call is well under 1 s). */
export const AUTH_DEADLINE_MS = 5000;

export class DeadlineError extends Error {
  readonly stage: string;
  constructor(stage: string) {
    super(`Deadline exceeded: ${stage}`);
    this.name = "DeadlineError";
    this.stage = stage;
  }
}

/**
 * A `fetch` that gives up after `ms`. supabase-js has no timeout of its own, so a connection that
 * stalls without failing would otherwise hold the whole request until the platform kills it.
 * Logs only the stage name and the limit, never the URL, headers or body (AGENTS.md rule 8).
 */
export function fetchWithDeadline(
  stage: string,
  ms: number = AUTH_DEADLINE_MS,
): typeof globalThis.fetch {
  // supabase-js retries a failed token refresh several times with backoff. Once one call has hit
  // the deadline, later calls from the same client fail at once instead of hanging again.
  let tripped = false;
  return async (input, init) => {
    if (tripped) throw new DeadlineError(stage);
    const timeout = AbortSignal.timeout(ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    try {
      return await globalThis.fetch(input, { ...init, signal });
    } catch (err) {
      if (timeout.aborted && !init?.signal?.aborted) {
        tripped = true;
        logger.warn({ stage, ms }, "Deadline exceeded");
        throw new DeadlineError(stage);
      }
      throw err;
    }
  };
}

/**
 * Bounds a whole Auth call (e.g. getUser, getClaims) at `ms`, including the client's own retries,
 * which a per-fetch deadline cannot bound. The abandoned call is not cancelled; its late result or
 * failure is swallowed. Logs the stage name and limit only.
 */
export async function withDeadline<T>(
  stage: string,
  work: () => Promise<T>,
  ms: number = AUTH_DEADLINE_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const call = work();
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      call.catch(() => undefined);
      logger.warn({ stage, ms }, "Deadline exceeded");
      reject(new DeadlineError(stage));
    }, ms);
  });
  try {
    return await Promise.race([call, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
