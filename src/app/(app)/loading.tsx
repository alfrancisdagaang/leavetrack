import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown inside the app shell while any signed-in page loads its data, so a click on a nav link
 * gives feedback at once instead of freezing on the old page. Next.js uses this file as the
 * loading boundary for every page in the (app) group.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>

      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            aria-hidden="true"
            className="space-y-3 rounded-card border border-grey-200 bg-white p-5 shadow-sm sm:p-6"
          >
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
