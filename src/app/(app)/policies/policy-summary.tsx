import { StatTiles } from "@/components/ui/stat-tiles";
import type { PolicySummary } from "@/lib/leave/policies";
import { DEFAULT_POLICY_QUERY } from "@/lib/leave/policies-schema";
import { policiesHref } from "./policies-url";

/**
 * Three company-wide numbers (they ignore the search and the filters). The second and third link to the
 * matching filter, so a tile is also a shortcut.
 */
export function PolicySummaryTiles({ summary }: { summary: PolicySummary }) {
  return (
    <StatTiles
      tiles={[
        {
          icon: "/icons/users-card.svg",
          tint: "bg-brand-50",
          value: summary.employees,
          label: summary.employees === 1 ? "employee" : "employees",
        },
        {
          icon: "/icons/triangle-alert.svg",
          tint: "bg-pending-bg",
          value: summary.noPolicy,
          label: "with no policy yet",
          href: policiesHref({ ...DEFAULT_POLICY_QUERY, status: "none" }),
        },
        {
          icon: "/icons/clock-3.svg",
          tint: "bg-approved-bg",
          value: summary.changedThisMonth,
          label: "changed this month",
          href: policiesHref({ ...DEFAULT_POLICY_QUERY, status: "changed" }),
        },
      ]}
    />
  );
}
