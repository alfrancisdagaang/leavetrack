import { Alert } from "@/components/ui/alert";
import type { OrgNode, OrgPage } from "@/lib/leave/org";
import { OrgHrTree } from "./org-hr-tree";
import { ChartShell, ManagerAside } from "./org-parts";
import { rootsNote } from "./org-text";

/**
 * HR's view: the people at the top of the company, each opening to their reports (the client tree),
 * and HR's own manager as plain text at the side. If more people sit at the top than one page of 50, a
 * note says so: the route pages a person's reports, not the roots.
 */
export function HrChart({
  roots,
  manager,
  managerUnavailable,
  viewerId,
}: {
  roots: OrgPage;
  manager: OrgNode | null;
  managerUnavailable: boolean;
  viewerId: string;
}) {
  return (
    <ChartShell
      title="The company"
      subtitle="Browse the reporting lines across the company."
      aside={<ManagerAside manager={manager} unavailable={managerUnavailable} />}
      wide
    >
      {roots.total > roots.people.length ? (
        <div className="mb-3">
          <Alert variant="info">{rootsNote(roots.people.length, roots.total)}</Alert>
        </div>
      ) : null}
      {roots.people.length === 0 ? (
        <p className="text-ink-muted">Nobody is at the top of the chart yet.</p>
      ) : (
        <OrgHrTree roots={roots.people} viewerId={viewerId} />
      )}
    </ChartShell>
  );
}
