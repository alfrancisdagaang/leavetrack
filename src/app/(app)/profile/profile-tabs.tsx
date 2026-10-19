import Link from "next/link";

const TABS = [
  { key: "overview", label: "Overview", href: "/profile" },
  { key: "organization", label: "Organization", href: "/profile/organization" },
  { key: "settings", label: "Account settings", href: "/profile/settings" },
] as const;

export type ProfileTab = (typeof TABS)[number]["key"];

/**
 * The three sections of My Profile. They are separate routes (each page stays inside the query
 * budget), so this is a navigation landmark with links styled as tabs and `aria-current` on the
 * open one, not role="tablist" (which is for panels inside one page). No data: it adds no query.
 * Padding is tighter below `sm` so all three fit at 375 px; at 320 px the strip scrolls inside
 * itself rather than widening the page.
 */
export function ProfileTabs({ active }: { active: ProfileTab }) {
  return (
    <nav aria-label="My Profile sections" className="mb-6 overflow-x-auto border-b border-line">
      <ul className="-mb-px flex min-w-max gap-1 sm:gap-2">
        {TABS.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                prefetch={false}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 px-2 text-sm font-semibold sm:px-4 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 ${
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
