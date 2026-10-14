import type { ReactNode } from "react";

/**
 * Loading placeholders that mirror the real pages (same header, card and form-field shapes), so
 * the layout does not jump when the data arrives. Purely decorative: the busy state is announced
 * once by <LoadingRegion>, and the blocks themselves are hidden from assistive technology.
 * The pulse is skipped for people who ask for reduced motion.
 */

/** A grey placeholder block. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-md bg-grey-200 motion-safe:animate-pulse ${className}`}
    />
  );
}

/** Wraps a page's placeholders and announces "Loading…" to screen readers once. */
export function LoadingRegion({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

/** Mirrors <PageHeader>: a title, a description and, optionally, an action button. */
export function SkeletonHeader({ action = false }: { action?: boolean }) {
  return (
    <div aria-hidden="true" className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {action ? <Skeleton className="h-11 w-32" /> : null}
    </div>
  );
}

/** Mirrors <Card>. */
export function SkeletonCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-card border border-grey-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

/** Mirrors <Field>: a label and a form control (44px tall, like the real inputs). */
export function SkeletonField({ tall = false }: { tall?: boolean }) {
  return (
    <div aria-hidden="true" className="space-y-1.5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className={tall ? "h-24 w-full" : "h-11 w-full"} />
    </div>
  );
}
