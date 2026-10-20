import Image from "next/image";

export type StatTile = {
  icon: string;
  /** A token background class for the round icon, such as `bg-brand-50`. */
  tint: string;
  value: number;
  label: string;
  /** When set the whole tile is a link (a shortcut to the matching filter). */
  href?: string;
};

const TILE =
  "flex min-w-0 flex-col items-start justify-center gap-1 rounded-tile border border-brand-50 bg-white p-3 shadow-tile sm:flex-row sm:items-center sm:gap-4 sm:p-4";

function Tile({ icon, tint, value, label, href }: StatTile) {
  const body = (
    <>
      <span
        aria-hidden="true"
        className={`hidden size-12 shrink-0 items-center justify-center rounded-full sm:flex ${tint}`}
      >
        <Image src={icon} alt="" width={24} height={24} unoptimized />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-semibold text-ink sm:text-2xl">
          {value.toLocaleString("en-US")}
        </span>
        <span className="block text-xs text-ink-muted sm:text-sm">{label}</span>
      </span>
    </>
  );
  return href ? (
    <a href={href} className={`${TILE} hover:bg-brand-50`}>
      {body}
    </a>
  ) : (
    <div className={TILE}>{body}</div>
  );
}

/**
 * Three numbers above a list, in a row (small on a phone, with an icon from sm). They describe the
 * whole scope (a team, the company), never the current search or filters. A tile with an `href` is a
 * shortcut to the matching filter. Shared by Leave Policies, Team Approvals and Balance Overrides.
 */
export function StatTiles({ tiles, label = "Summary" }: { tiles: StatTile[]; label?: string }) {
  return (
    <section aria-label={label} className="grid grid-cols-3 gap-2 sm:gap-3">
      {tiles.map((tile) => (
        <Tile key={tile.label} {...tile} />
      ))}
    </section>
  );
}
