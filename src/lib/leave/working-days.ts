/**
 * Working-day arithmetic (Mon-Fri, holidays out of scope). Pure and dependency-free so the
 * server and the request form share one implementation.
 * Dates are `YYYY-MM-DD` strings parsed as UTC so the server's timezone can never shift a day.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMs(value: string): number | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  // Date.UTC rolls 2026-02-30 over into March; reject anything that did not round-trip.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return ms;
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isRealIsoDate(value: string): boolean {
  return toUtcMs(value) !== null;
}

/**
 * Working days (Mon-Fri) in the inclusive range. Returns 0 for a weekend-only range, and for
 * an invalid or reversed range (callers validate those separately).
 */
export function countWorkingDays(start: string, end: string): number {
  const startMs = toUtcMs(start);
  const endMs = toUtcMs(end);
  if (startMs === null || endMs === null || endMs < startMs) return 0;

  let count = 0;
  for (let ms = startMs; ms <= endMs; ms += DAY_MS) {
    const weekday = new Date(ms).getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}
