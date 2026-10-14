/**
 * A grey placeholder block shown while a server-rendered page waits for its data.
 * Decorative: screen readers get the "Loading" message from the page's loading state instead.
 * The pulse is skipped for people who ask for reduced motion.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded bg-grey-200 motion-safe:animate-pulse ${className}`}
    />
  );
}
