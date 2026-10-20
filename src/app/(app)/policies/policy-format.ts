import type { PolicyChangeView, PolicyLastChange, PolicyRate } from "@/lib/leave/policies";

/** "1.5" and "1.50" both read "1.5"; whole numbers read without decimals ("2.00" becomes "2"). */
export function formatRate(rate: string): string {
  return String(Number(rate));
}

/** "Hana Reyes set Elena Cruz's Vacation rate to 1.5 days a month" or "... from 1.25 to 1.5 ...". */
export function describeChange(c: PolicyChangeView): string {
  const who = `${c.changedByName} ${c.oldRate === null ? "set" : "changed"} ${c.employeeName}'s ${c.leaveTypeName} rate`;
  return c.oldRate === null
    ? `${who} to ${formatRate(c.newRate)} days a month`
    : `${who} from ${formatRate(c.oldRate)} to ${formatRate(c.newRate)} days a month`;
}

/** "Oct 20, 2026, 9:41 AM" in the app's time zone. */
export function formatWhen(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** "Oct 20, 2026 by Hana Reyes" in the app's time zone, or "Never" when nothing was ever changed. */
export function formatLastChange(change: PolicyLastChange | null, timeZone: string): string {
  if (!change) return "Never";
  const day = new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "medium" }).format(
    new Date(change.at),
  );
  return `${day} by ${change.by}`;
}

/** "No policy yet" when any shown rate is missing, otherwise "Up to date". */
export function policyStatus(rates: readonly Pick<PolicyRate, "rate">[]): "none" | "ok" {
  return rates.some((r) => r.rate === null) ? "none" : "ok";
}
