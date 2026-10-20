import Image from "next/image";
import type { PolicySummary } from "@/lib/leave/policies";
import { policiesHref } from "./policies-url";
import { DEFAULT_POLICY_QUERY } from "@/lib/leave/policies-schema";

const TILE =
  "flex min-w-0 flex-col items-start justify-center gap-1 rounded-tile border border-brand-50 bg-white p-3 shadow-tile sm:flex-row sm:items-center sm:gap-4 sm:p-4";

function Tile({
  icon,
  tint,
  value,
  label,
  href,
}: {
  icon: string;
  tint: string;
  value: number;
  label: string;
  href?: string;
}) {
  const body = (
    <>
      <span
        aria-hidden="true"
        className={`hidden size-12 shrink-0 items-center justify-center rounded-full sm:flex ${tint}`}
      >
        <Image src={icon} alt="" width={24} height={24} unoptimized />
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-semibold text-ink">
          {value.toLocaleString("en-US")}
        </span>
        <span className="block text-xs text-ink-muted sm:text-sm">{label}</span>
      </span>
    </>
  );
  return href ? (
    <a href={href} className={`${TILE} hover:bg-brand-50`}>
      {body}
    </a>
  ) : (
    <div className={TILE}>{body}</div>
  );
}

/**
 * Three company-wide numbers (they ignore the search and the filters). The second and third link to the
 * matching filter, so a tile is also a shortcut.
 */
export function PolicySummaryTiles({ summary }: { summary: PolicySummary }) {
  return (
    <section aria-label="Summary" className="grid grid-cols-3 gap-2 sm:gap-3">
      <Tile
        icon="/icons/users-card.svg"
        tint="bg-brand-50"
        value={summary.employees}
        label={summary.employees === 1 ? "employee" : "employees"}
      />
      <Tile
        icon="/icons/triangle-alert.svg"
        tint="bg-pending-bg"
        value={summary.noPolicy}
        label="with no policy yet"
        href={policiesHref({ ...DEFAULT_POLICY_QUERY, status: "none" })}
      />
      <Tile
        icon="/icons/clock-3.svg"
        tint="bg-approved-bg"
        value={summary.changedThisMonth}
        label="changed this month"
        href={policiesHref({ ...DEFAULT_POLICY_QUERY, status: "changed" })}
      />
    </section>
  );
}
