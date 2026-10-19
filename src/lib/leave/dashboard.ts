import { canApproveLeave, canRequestLeave } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/db/types";
import type { BalanceSummaryItem } from "@/lib/leave/balance";
import type { IsoDate } from "@/lib/leave/calendar-layout";
import { longDay } from "@/lib/leave/hr-calendar-layout";
import { outToday, windowEnd, type OutFigures } from "@/lib/leave/out-figures";

/** What one dashboard summary card shows. Pure data: the component only lays it out. */
export type SummaryCardView = {
  key: string;
  title: string;
  kind: "balance" | "untracked" | "count" | "unavailable";
  /** The big number (balance days or request count); null for untracked and unavailable. */
  amount: number | null;
  /** Small unit after the number ("days", "requests"). */
  unit: string | null;
  /** Big word shown instead of a number, e.g. "Untracked". */
  headline: string | null;
  lines: string[];
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function pendingLine(days: number): string {
  return days > 0 ? `${plural(days, "day", "days")} pending approval` : "No days pending approval";
}

function balanceCard(item: BalanceSummaryItem): SummaryCardView {
  const key = item.leaveTypeName.toLowerCase();
  if (!item.tracksBalance) {
    return {
      key,
      title: item.leaveTypeName,
      kind: "untracked",
      amount: null,
      unit: null,
      headline: "Untracked",
      lines: ["No balance tracked.", "Request as needed."],
    };
  }
  return {
    key,
    title: item.leaveTypeName,
    kind: "balance",
    amount: item.confirmed ?? 0,
    unit: (item.confirmed ?? 0) === 1 ? "day" : "days",
    headline: null,
    lines: ["Confirmed balance", pendingLine(item.pending)],
  };
}

const unavailableCard = (key: string, title: string): SummaryCardView => ({
  key,
  title,
  kind: "unavailable",
  amount: null,
  unit: null,
  headline: null,
  lines: ["Not available right now."],
});

const people = (n: number) => (n === 1 ? "person" : "people");

/** "Out today": how many are out, or the word Weekend (nobody is counted on a Saturday or Sunday). */
function outTodayCard(out: OutFigures | null, today: IsoDate, where: string): SummaryCardView {
  if (!out) return unavailableCard("out-today", "Out today");
  const t = outToday(out, today);
  if (t.weekend) {
    return {
      key: "out-today",
      title: "Out today",
      kind: "count",
      amount: null,
      unit: null,
      headline: "Weekend",
      lines: ["Nobody is counted", "on weekends."],
    };
  }
  return {
    key: "out-today",
    title: "Out today",
    kind: "count",
    amount: t.total,
    unit: people(t.total),
    headline: null,
    lines:
      t.total === 0
        ? [`Nobody is out ${where}.`]
        : [
            `${where[0]!.toUpperCase()}${where.slice(1)}.`,
            t.pending > 0 ? `${t.pending} still pending.` : "None pending.",
          ],
  };
}

/**
 * The dashboard's summary cards (EPIC-10). Only employees have a balance, so only they get the
 * Vacation, Sick and Unpaid cards. Managers get Pending approvals, who is out today and in the next
 * 7 days on their team; HR admins get the override count, who is out today and every pending request. A null input means that query failed, and the card says so
 * instead of showing a made-up number.
 */
export function summaryCards(input: {
  role: UserRole;
  balances: readonly BalanceSummaryItem[] | null;
  pendingApprovals: number | null;
  overrides?: number | null;
  /** The who-is-out figures (HR admins and managers) and today's date; null when unavailable. */
  out?: OutFigures | null;
  today?: IsoDate;
}): SummaryCardView[] {
  const cards: SummaryCardView[] = [];
  if (canRequestLeave(input.role)) {
    cards.push(
      ...(input.balances
        ? input.balances.map(balanceCard)
        : [
            unavailableCard("vacation", "Vacation"),
            unavailableCard("sick", "Sick"),
            unavailableCard("unpaid", "Unpaid"),
          ]),
    );
  }

  if (input.role === "hr_admin") {
    const n = input.overrides ?? null;
    cards.push(
      n === null
        ? unavailableCard("overrides", "Awaiting HR override")
        : {
            key: "overrides",
            title: "Awaiting HR override",
            kind: "count",
            amount: n,
            unit: n === 1 ? "request" : "requests",
            headline: null,
            lines:
              n > 0
                ? ["Over the balance,", "waiting for HR."]
                : ["Nothing is waiting", "for an override."],
          },
    );
    const out = input.out ?? null;
    cards.push(outTodayCard(out, input.today ?? "", "across the company"));
    cards.push(
      out === null
        ? unavailableCard("pending-all", "Pending requests")
        : {
            key: "pending-all",
            title: "Pending requests",
            kind: "count",
            amount: out.pendingTotal,
            unit: out.pendingTotal === 1 ? "request" : "requests",
            headline: null,
            lines: ["Waiting for a decision", "across the company."],
          },
    );
  }

  if (canApproveLeave(input.role)) {
    const n = input.pendingApprovals;
    cards.push(
      n === null
        ? unavailableCard("approvals", "Pending approvals")
        : {
            key: "approvals",
            title: "Pending approvals",
            kind: "count",
            amount: n,
            unit: n === 1 ? "request" : "requests",
            headline: null,
            lines:
              n > 0
                ? ["Your team is waiting", "for your review."]
                : ["Nothing is waiting", "for your review."],
          },
    );
    const out = input.out ?? null;
    cards.push(outTodayCard(out, input.today ?? "", "on your team"));
    cards.push(
      out === null
        ? unavailableCard("out-week", "Out in the next 7 days")
        : {
            key: "out-week",
            title: "Out in the next 7 days",
            kind: "count",
            amount: out.weekPeople,
            unit: people(out.weekPeople),
            headline: null,
            lines: ["On your team,", `through ${longDay(windowEnd(input.today ?? ""))}.`],
          },
    );
  }
  return cards;
}

/**
 * The sentence under "Welcome back". Managers also hear how many approvals are waiting, HR admins
 * how many requests wait for an override (passed in the same argument).
 */
export function welcomeSubtitle(role: UserRole, pendingApprovals: number | null): string {
  if (role === "employee") return "Your leave balance and requests, at a glance.";
  if (role === "hr_admin") {
    const base = "Company leave, overrides and the audit record, at a glance.";
    if (pendingApprovals === null) return base;
    if (pendingApprovals === 0) return `${base} No overrides are waiting.`;
    return `${base} ${plural(pendingApprovals, "request waits", "requests wait")} for an override.`;
  }
  const base = "Your team's leave and approvals, at a glance.";
  if (pendingApprovals === null) return base;
  if (pendingApprovals === 0) return `${base} No approvals are waiting.`;
  return `${base} You have ${plural(pendingApprovals, "approval", "approvals")} to review.`;
}
