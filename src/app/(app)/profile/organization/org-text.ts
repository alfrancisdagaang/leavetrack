/**
 * TASK-064 (EPIC-11). The wording of the Organization tab in one place, pure and tested: how many
 * reports a person has, the label of the HR expand button, and the "showing" notes.
 */

/** "No direct reports", "1 direct report", "7 direct reports". */
export function reportsLabel(n: number): string {
  if (n <= 0) return "No direct reports";
  return n === 1 ? "1 direct report" : `${n} direct reports`;
}

/** The accessible name of the HR expand button: it says what it opens and for whom. */
export function toggleLabel(name: string, reports: number, open: boolean): string {
  const noun = reports === 1 ? "report" : "reports";
  return `${open ? "Hide" : "Show"} ${reports} ${noun} of ${name}`;
}

/** "Showing 200 of 250 people under you." Only used when the list was cut. */
export function cutNote(shown: number, total: number): string {
  return `Showing ${shown} of ${total} people under you.`;
}

/** The note under HR's company roots when there are more than one page of them. */
export function rootsNote(shown: number, total: number): string {
  return `Showing ${shown} of ${total} people at the top of the company.`;
}

/** A person whose own reports were not loaded (the depth cap or the 200 cut). */
export function notShownLabel(n: number): string {
  return n === 1 ? "1 report not shown" : `${n} reports not shown`;
}

/** "Show 50 more" / "Show 5 more": the next page is at most `pageSize`. */
export function showMoreLabel(remaining: number, pageSize: number): string {
  return `Show ${Math.min(remaining, pageSize)} more`;
}
