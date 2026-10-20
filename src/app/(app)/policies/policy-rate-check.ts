import { POLICY_RATE_MAX } from "@/lib/leave/policies-schema";

/** The first problem with a typed rate, or null. The route checks everything again and stays the authority. */
export function rateProblem(value: string): string | null {
  const n = value.trim() === "" ? Number.NaN : Number(value);
  if (Number.isNaN(n)) return "Enter a number of days a month.";
  if (n < 0) return "The rate cannot be negative.";
  if (n > POLICY_RATE_MAX) return `The rate cannot be more than ${POLICY_RATE_MAX} days a month.`;
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-9) return "Use at most two decimals.";
  return null;
}

/** True when what is typed is already the saved rate ("1.5" and "1.50" are the same), so nothing is sent. */
export function isUnchanged(typed: string, saved: string | null): boolean {
  const text = typed.trim();
  if (saved === null) return text === "";
  return text !== "" && Number(text) === Number(saved);
}
