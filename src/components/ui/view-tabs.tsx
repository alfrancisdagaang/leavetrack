import Link from "next/link";

export type ViewTab = { key: string; label: string; href: string };

/**
 * Two or three views of one page (Pending and Decided, Waiting and Overridden). Each view is a link to
 * the same route with `?view=`, so this is a navigation landmark with `aria-current` on the open one, not
 * `role="tablist"` (which is for panels inside one page), like the My Profile tabs. Switching a view clears
 * the filters: their choices differ per view. The strip scrolls inside itself rather than widening the page.
 */
export function ViewTabs({
  tabs,
  active,
  label,
}: {
  tabs: readonly ViewTab[];
  active: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="mb-6 overflow-x-auto border-b border-line">
      <ul className="-mb-px flex min-w-max gap-1 sm:gap-2">
        {tabs.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                prefetch={false}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 sm:px-4 ${
                  current
                    ? "border-brand-500 text-brand-600"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
