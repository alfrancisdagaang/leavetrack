import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/guards";
import type { AuditAction, LeaveStatus } from "@/lib/db/types";
import { AppError } from "@/lib/errors/app-error";
import {
  getAuditHistory,
  listEmployees,
  type AuditHistory,
  type AuditRequestView,
} from "@/lib/leave/audit";
import { auditQuerySchema, requestIdSchema } from "@/lib/leave/schemas";
import { requireDb } from "@/lib/leave/service";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<LeaveStatus, { variant: BadgeVariant; label: string }> = {
  pending: { variant: "pending", label: "Pending" },
  approved: { variant: "approved", label: "Approved" },
  rejected: { variant: "rejected", label: "Rejected" },
};

const ACTION_LABEL: Record<AuditAction, string> = {
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  soft_deleted: "Removed (soft-deleted)",
};

const days = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;

/** Times are shown in UTC with the zone written out, so there is no doubt which day a record is on. */
function utc(value: Date | string): string {
  return `${new Date(value).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

type SearchParams = Record<string, string | string[] | undefined>;

function RequestCard({ r }: { r: AuditRequestView }) {
  const badge = STATUS_BADGE[r.status];
  return (
    <Card title={`${r.leave_type_name} · ${days(r.working_days)}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {r.is_deleted ? <Badge>Deleted</Badge> : null}
      </div>
      <p className="text-grey-900">
        {r.start_date} to {r.end_date}
      </p>
      <p className="mt-1 text-sm text-grey-500">
        {r.decided_at && r.decided_by_name
          ? `Decided by ${r.decided_by_name} on ${utc(r.decided_at)}`
          : "Awaiting decision"}
      </p>
      {r.decision_note ? (
        <p className="mt-1 break-words text-sm text-grey-700">Reason given: {r.decision_note}</p>
      ) : null}
      <ol className="mt-3 space-y-1 border-t border-grey-200 pt-3 text-sm text-grey-700">
        {r.events.map((e, i) => (
          <li key={`${e.action}-${i}`} className="break-words">
            {ACTION_LABEL[e.action]} by {e.actor_name} · {utc(e.occurred_at)}
          </li>
        ))}
      </ol>
    </Card>
  );
}

/**
 * US-05. HR's decision history for one employee, with an optional date range. The filters live in
 * the URL (a plain GET form), so the page needs no client JavaScript. HR admins only.
 */
export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireRole("hr_admin");
  const params = await searchParams;
  const one = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;

  const sql = requireDb();
  const employees = await listEmployees(sql);

  const userParam = one("user");
  const includeDeleted = one("deleted") === "1";
  let history: AuditHistory | null = null;
  let problem: string | null = null;

  if (userParam) {
    const id = requestIdSchema.safeParse(userParam);
    const query = auditQuerySchema.safeParse({
      from: one("from"),
      to: one("to"),
      include_deleted: includeDeleted ? "true" : "false",
    });
    if (!id.success) {
      problem = "Choose an employee from the list.";
    } else if (!query.success) {
      problem = query.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } else {
      try {
        history = await getAuditHistory(sql, id.data, query.data);
      } catch (err) {
        if (err instanceof AppError && err.code === "NOT_FOUND") problem = err.message;
        else throw err;
      }
    }
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="The decision record for any employee. Records are never purged."
      />

      <Card>
        <form method="get" action="/audit" className="space-y-4">
          <Field id="user" label="Employee">
            <Select id="user" name="user" required defaultValue={userParam ?? ""}>
              <option value="" disabled>
                Select an employee
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="from" label="From (optional)">
              <Input id="from" name="from" type="date" defaultValue={one("from") ?? ""} />
            </Field>
            <Field
              id="to"
              label="To (optional)"
              hint="Days are UTC; a request matches if any event on it falls in the range."
            >
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={one("to") ?? ""}
                aria-describedby="to-hint"
              />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm text-grey-900">
            <input
              type="checkbox"
              name="deleted"
              value="1"
              defaultChecked={includeDeleted}
              className="size-5"
            />
            Include soft-deleted records
          </label>
          <Button type="submit" className="w-full sm:w-auto">
            Show history
          </Button>
        </form>
      </Card>

      {problem ? (
        <div className="mt-4">
          <Alert variant="error">{problem}</Alert>
        </div>
      ) : null}

      {history ? (
        <section className="mt-6" aria-labelledby="audit-results">
          <h2 id="audit-results" className="mb-1 text-lg font-semibold text-navy-900">
            {history.employee.name}
          </h2>
          <p className="mb-4 text-sm text-grey-500">
            {history.requests.length} request{history.requests.length === 1 ? "" : "s"}
            {includeDeleted ? " (including soft-deleted)" : ""}. Soft-deleted requests are hidden
            unless included; nothing is ever purged.
          </p>
          {history.requests.length === 0 ? (
            <Card>
              <p className="text-grey-500">No requests found for this employee and range.</p>
            </Card>
          ) : (
            <ul className="space-y-4">
              {history.requests.map((r) => (
                <li key={r.id}>
                  <RequestCard r={r} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}
