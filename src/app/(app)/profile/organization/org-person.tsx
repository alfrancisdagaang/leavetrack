import { initialsOf } from "@/components/ui/initials";
import type { OrgNode } from "@/lib/leave/org";
import { ROLE_LABEL } from "../../approvals/team/team-format";
import { reportsLabel } from "./org-text";

/** The small "You" tag. Text, so the highlight is never colour alone. */
export function YouPill() {
  return (
    <span className="ml-2 rounded-full bg-white px-2 py-0.5 align-middle text-xs font-semibold text-brand-600 ring-1 ring-brand-500/30">
      You
    </span>
  );
}

/**
 * One person in the chart: initials, name, role in words and how many people report to them. Not a
 * link (nothing in the chart opens another person's profile) and it shows no email. Built from spans
 * so it is valid inside a `<summary>`. The viewer's own card has a blue border, says "You" in text
 * and carries `aria-current`. Long unbroken names wrap.
 */
export function PersonCard({ node, you = false }: { node: OrgNode; you?: boolean }) {
  return (
    <span
      aria-current={you ? "true" : undefined}
      className={`flex min-w-0 items-center gap-3 rounded-lg border bg-white p-3 shadow-sm ${
        you ? "border-2 border-brand-500 bg-brand-50" : "border-line"
      }`}
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-500"
      >
        {initialsOf(node.name)}
      </span>
      <span className="min-w-0">
        <span className="block break-words font-semibold text-ink [overflow-wrap:anywhere]">
          {node.name}
          {you ? <YouPill /> : null}
        </span>
        <span className="block text-sm text-ink-muted">
          {ROLE_LABEL[node.role]} · {reportsLabel(node.reports)}
        </span>
      </span>
    </span>
  );
}
