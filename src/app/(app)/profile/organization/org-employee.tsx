import type { EmployeeOrg } from "@/lib/leave/org";
import {
  ChartShell,
  Connector,
  EmptyReports,
  ManagerAbove,
  ManagerAside,
  ReportsHeading,
} from "./org-parts";
import { PersonCard } from "./org-person";

/**
 * The employee's view: their manager above, themselves highlighted, their direct reports below (or an
 * empty box), with their manager again as plain text at the side. Everything comes from one read of the
 * viewer's own neighbourhood, so a peer or another team never appears.
 */
export function EmployeeChart({ org }: { org: EmployeeOrg }) {
  return (
    <ChartShell
      title="Your place in the organization"
      subtitle="See who you report to and who reports to you."
      aside={<ManagerAside manager={org.manager} />}
    >
      <ManagerAbove manager={org.manager} />
      <PersonCard node={org.me} you />
      <Connector />
      <ReportsHeading>Direct reports</ReportsHeading>
      {org.reports.length === 0 ? (
        <EmptyReports />
      ) : (
        <ul className="space-y-2">
          {org.reports.map((r) => (
            <li key={r.id}>
              <PersonCard node={r} />
            </li>
          ))}
        </ul>
      )}
    </ChartShell>
  );
}
