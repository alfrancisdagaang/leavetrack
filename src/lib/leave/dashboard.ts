import { canApproveLeave, canRequestLeave } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/db/types";
import type { BalanceSummaryItem } from "@/lib/leave/balance";

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

/**
 * The dashboard's summary cards (EPIC-10). Only employees have a balance, so only they get the
 * Vacation, Sick and Unpaid cards; "Pending approvals" is for managers; HR admins get the count of
 * requests waiting for an override. A null input means that query failed, and the card says so
 * instead of showing a made-up number.
 */
export function summaryCards(input: {
  role: UserRole;
  balances: readonly BalanceSummaryItem[] | null;
  pendingApprovals: number | null;
  overrides?: number | null;
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
