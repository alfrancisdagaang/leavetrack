import Link from "next/link";

const TABS = [
  { key: "approvals", label: "Approvals", href: "/approvals" },
  { key: "team", label: "My team", href: "/approvals/team" },
] as const;

export type TeamTab = (typeof TABS)[number]["key"];

/**
 * The two sections of Team approvals: the pending queue and the manager's own team. They are
 * separate routes, so this is a navigation landmark with links styled as tabs and `aria-current` on
 * the open one (not role="tablist", which is for panels inside one page). No data: it adds no query.
 */
export function TeamTabs({ active }: { active: TeamTab }) {
  return (
    <nav aria-label="Team approvals sections" className="mb-6 border-b border-line">
      <ul className="-mb-px flex gap-2">
        {TABS.map((tab) => {
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                prefetch={false}
                aria-current={current ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 ${
                  current
                    ? "border-brand-500 text-ink"
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
