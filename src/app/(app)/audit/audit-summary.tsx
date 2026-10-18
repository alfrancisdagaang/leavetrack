import type { AuditCounts } from "@/lib/leave/audit-list";

/**
 * US-14. How many requests match the filters (all of them, not only this page), split by status.
 * Each figure is labelled in text. The buckets add up to the total: a soft-deleted request is counted
 * as Removed only.
 */
export function AuditSummary({ counts }: { counts: AuditCounts }) {
  const items: { label: string; value: number }[] = [
    { label: "Total requests", value: counts.total },
    { label: "Approved", value: counts.approved },
    { label: "Rejected", value: counts.rejected },
    { label: "Pending", value: counts.pending },
    { label: "Removed", value: counts.deleted },
  ];
  return (
    <section aria-label="Summary of matching requests" className="mb-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-tile border border-brand-50 bg-white p-4 shadow-tile"
          >
            <dt className="text-sm text-ink-muted">{item.label}</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
