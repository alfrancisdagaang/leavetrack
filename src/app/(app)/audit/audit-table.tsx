import Image from "next/image";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { initialsOf } from "@/components/ui/initials";
import { leaveTypeLook } from "@/components/ui/leave-type-icon";
import type { AuditListRow } from "@/lib/leave/audit-list";
import { ROLE_LABEL } from "@/app/(app)/approvals/team/team-format";
import { days, formatRange, statusBadge, utc } from "./audit-format";

const HEADER = "pb-2 pr-4 text-sm font-medium text-ink-muted";

function Person({ row }: { row: AuditListRow }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600"
      >
        {initialsOf(row.employeeName)}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{row.employeeName}</span>
        <span className="block text-sm font-normal text-ink-muted">
          {ROLE_LABEL[row.employeeRole]}
        </span>
      </span>
    </span>
  );
}

function TypeName({ row }: { row: AuditListRow }) {
  const look = leaveTypeLook(row.leaveTypeName);
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`flex size-7 shrink-0 items-center justify-center rounded-full ${look.tint}`}
      >
        <Image src={look.icon} alt="" width={16} height={16} unoptimized />
      </span>
      {row.leaveTypeName}
    </span>
  );
}

function Status({ row }: { row: AuditListRow }) {
  const badge = statusBadge(row.status, row.isDeleted, row.overridden);
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}

function decidedBy(row: AuditListRow): ReactNode {
  if (!row.decidedByName) return <span className="text-ink-muted">Awaiting decision</span>;
  return (
    <span>
      {row.decidedByName}
      {row.decidedByRole ? (
        <span className="block text-sm text-ink-muted">{ROLE_LABEL[row.decidedByRole]}</span>
      ) : null}
    </span>
  );
}

const decidedAt = (row: AuditListRow) => (row.decidedAt ? utc(row.decidedAt) : "Not decided");

/**
 * US-14. One page of the audit list. From the `sm` breakpoint a real table (column headers, the
 * employee as the row header); below it, stacked rows. Two native structures with the same rows, one
 * hidden by CSS at each size (the My Balance pattern), so the table's semantics are never switched off.
 */
export function AuditTable({
  rows,
  total,
  children,
}: {
  rows: readonly AuditListRow[];
  total: number;
  /** Shown under the rows: the pagination. */
  children?: ReactNode;
}) {
  return (
    <>
      <h2 className="mb-3 text-xl font-semibold text-ink">
        {`${total} request${total === 1 ? "" : "s"}`}
      </h2>
      <Card>
        <table aria-label="Leave requests" className="hidden w-full text-left sm:table">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={HEADER}>
                Employee
              </th>
              <th scope="col" className={HEADER}>
                Leave type
              </th>
              <th scope="col" className={HEADER}>
                Date range
              </th>
              <th scope="col" className={HEADER}>
                Working days
              </th>
              <th scope="col" className={HEADER}>
                Status
              </th>
              <th scope="col" className={HEADER}>
                Decided by
              </th>
              <th scope="col" className="pb-2 text-sm font-medium text-ink-muted">
                Decided at
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <th scope="row" className="py-3 pr-4 font-normal">
                  <Person row={r} />
                </th>
                <td className="py-3 pr-4 text-ink">
                  <TypeName row={r} />
                </td>
                <td className="py-3 pr-4 text-ink">{formatRange(r.startDate, r.endDate)}</td>
                <td className="py-3 pr-4 text-ink">{days(r.workingDays)}</td>
                <td className="py-3 pr-4">
                  <Status row={r} />
                </td>
                <td className="py-3 pr-4 text-ink">{decidedBy(r)}</td>
                <td className="py-3 text-ink">{decidedAt(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul aria-label="Leave requests" className="divide-y divide-line sm:hidden">
          {rows.map((r) => (
            <li key={r.id} className="space-y-2 py-3">
              <div className="flex items-start justify-between gap-3">
                <Person row={r} />
                <Status row={r} />
              </div>
              <p className="text-ink">
                <TypeName row={r} />
              </p>
              <p className="text-sm text-ink-muted">
                {formatRange(r.startDate, r.endDate)} · {days(r.workingDays)}
              </p>
              <p className="text-sm text-ink">
                {r.decidedByName
                  ? `Decided by ${r.decidedByName} on ${decidedAt(r)}`
                  : "Awaiting decision"}
              </p>
            </li>
          ))}
        </ul>

        {children}
      </Card>
    </>
  );
}
