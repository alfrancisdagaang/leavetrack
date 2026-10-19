import Image from "next/image";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { initialsOf } from "@/components/ui/initials";
import type { OrgNode } from "@/lib/leave/org";
import { ROLE_LABEL } from "../../approvals/team/team-format";
import { PersonCard } from "./org-person";

/** A short vertical line between two levels of the chart. Decoration only. */
export function Connector() {
  return <div aria-hidden="true" className="mx-auto h-6 w-px bg-grey-300" />;
}

/** The small key at the bottom left of the chart card. */
export function Legend() {
  return (
    <p className="inline-flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink-muted">
      <span aria-hidden="true" className="h-px w-8 shrink-0 bg-brand-500" />
      Reporting line: each person reports to the one above.
    </p>
  );
}

/**
 * The chart card: a title and a line of help, the chart in a centred column and "Your manager" at the
 * right from `lg`. `grid-cols-1` keeps the column shrinkable below `lg`: a grid item is otherwise as
 * wide as its longest word and a long unbroken name scrolls the page sideways. `wide` is for the
 * trees (manager and HR), which need more room than the single column of an employee's chart.
 */
export function ChartShell({
  title,
  subtitle,
  aside,
  wide = false,
  children,
}: {
  title: string;
  subtitle: string;
  aside: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
          <div className={`mx-auto mt-6 w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>{children}</div>
          <div className="mt-6">
            <Legend />
          </div>
        </div>
        <aside className="min-w-0 self-start">{aside}</aside>
      </div>
    </Card>
  );
}

/** The person above the viewer, or a plain line at the top of the chart. */
export function ManagerAbove({ manager }: { manager: OrgNode | null }) {
  if (!manager) {
    return (
      <>
        <p className="rounded-lg border border-dashed border-line p-3 text-center text-sm text-ink-muted">
          No manager: you are at the top of the chart.
        </p>
        <Connector />
      </>
    );
  }
  return (
    <>
      <PersonCard node={manager} />
      <Connector />
    </>
  );
}

/** The label above the people who report to the viewer. */
export function ReportsHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-sm font-semibold text-ink">{children}</h3>;
}

/** Nobody reports to the viewer: a dashed box in the chart rather than a bare line of text. */
export function EmptyReports() {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-line px-4 py-6 text-center">
      <Image src="/icons/users-card.svg" alt="" width={24} height={24} unoptimized />
      <p className="font-semibold text-ink">No direct reports</p>
      <p className="text-sm text-ink-muted">Team members reporting to you will appear here.</p>
    </div>
  );
}

/**
 * "Your manager" beside the chart: name and role as plain text, never a link (nothing in the chart
 * opens another person's profile). `unavailable` is for HR, whose manager comes from a read that can
 * fail without taking the chart down.
 */
export function ManagerAside({
  manager,
  unavailable = false,
}: {
  manager: OrgNode | null;
  unavailable?: boolean;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <h3 className="font-semibold text-ink">Your manager</h3>
      {unavailable ? (
        <p className="mt-3 text-sm text-ink-muted">Your manager could not be loaded right now.</p>
      ) : manager ? (
        <div className="mt-3 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-500"
          >
            {initialsOf(manager.name)}
          </span>
          <div className="min-w-0">
            <p className="break-words font-semibold text-ink [overflow-wrap:anywhere]">
              {manager.name}
            </p>
            <p className="text-sm text-ink-muted">{ROLE_LABEL[manager.role]}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">
          You have no manager: you are at the top of the chart.
        </p>
      )}
    </div>
  );
}
