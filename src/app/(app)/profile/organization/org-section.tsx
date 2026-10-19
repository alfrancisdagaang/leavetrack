import { unstable_rethrow } from "next/navigation";
import { timedRead } from "@/lib/db/timed";
import type { UserRole } from "@/lib/db/types";
import { getEmployeeOrg, getManagerOrg, getOrgRoots } from "@/lib/leave/org";
import { requireDb } from "@/lib/leave/service";
import { logger } from "@/lib/logger";
import { EmployeeChart } from "./org-employee";
import { ProfileSummary } from "./org-header";
import { HrChart } from "./org-hr";
import { ManagerChart } from "./org-manager";
import { OrgError } from "./org-states";

/** The signed-in person, from the session: their id scopes every read, the rest fills the summary. */
export type OrgViewer = { id: string; name: string; email: string };

/** One read, retried once by `timedRead`; a failure is logged (never an id or a name) and becomes null. */
function attempt<T>(name: string, run: () => Promise<T | null>): Promise<T | null> {
  return timedRead(name, run).catch((err: unknown): null => {
    unstable_rethrow(err);
    logger.warn({ err, query: name }, "profile: organization unavailable");
    return null;
  });
}

/**
 * The Organization tab's data, chosen from the SESSION role (the reads also check the role in their own
 * SQL): an employee reads their neighbourhood, a manager their subtree, HR the roots of the company
 * and their own manager. One statement for an employee and a manager, two (in parallel) for HR. The
 * summary at the top needs no statement of its own: it is the session user plus the manager from the
 * chart read, and it stays up when the chart cannot be read, with the alert below it.
 */
export async function OrgSection({ role, viewer }: { role: UserRole; viewer: OrgViewer }) {
  const summary = (manager?: Parameters<typeof ProfileSummary>[0]["manager"]) => (
    <ProfileSummary name={viewer.name} role={role} email={viewer.email} manager={manager} />
  );
  const stack = (top: React.ReactNode, chart: React.ReactNode) => (
    <div className="space-y-6">
      {top}
      {chart}
    </div>
  );

  if (role === "employee") {
    const org = await attempt("profile.org_employee", () => getEmployeeOrg(requireDb(), viewer.id));
    return stack(summary(org?.manager), org ? <EmployeeChart org={org} /> : <OrgError />);
  }
  if (role === "manager") {
    const org = await attempt("profile.org_manager", () => getManagerOrg(requireDb(), viewer.id));
    return stack(summary(org?.manager), org ? <ManagerChart org={org} /> : <OrgError />);
  }
  const [roots, mine] = await Promise.all([
    attempt("profile.org_roots", () => getOrgRoots(requireDb(), { viewerId: viewer.id })),
    attempt("profile.org_hr_manager", () => getEmployeeOrg(requireDb(), viewer.id)),
  ]);
  return stack(
    summary(mine ? mine.manager : undefined),
    roots ? (
      <HrChart
        roots={roots}
        manager={mine?.manager ?? null}
        managerUnavailable={mine === null}
        viewerId={viewer.id}
      />
    ) : (
      <OrgError />
    ),
  );
}
