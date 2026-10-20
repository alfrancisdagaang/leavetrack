"use client";

import type { MouseEvent, ReactNode } from "react";
import { useFilterNav } from "@/components/ui/filter-shell";

/**
 * A column header that sorts. A plain click navigates on the client inside the FilterShell (only the
 * results change); a modified click keeps its normal meaning, and without JavaScript it is a link.
 * `direction` is the current order of THIS column, or null when the list is sorted by another one.
 * The arrow is decoration: the sort state is also in words for a screen reader (and on the header's
 * `aria-sort`, which the table puts on the `<th>`).
 */
export function SortHeader({
  href,
  direction,
  children,
}: {
  href: string;
  direction: "asc" | "desc" | null;
  children: ReactNode;
}) {
  const { navigate } = useFilterNav();
  const go = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    navigate(href);
  };
  return (
    <a href={href} onClick={go} className="inline-flex min-h-9 items-center gap-1 hover:text-ink">
      <span>{children}</span>
      <span aria-hidden="true">{direction === null ? "↕" : direction === "asc" ? "▲" : "▼"}</span>
      <span className="sr-only">
        {direction === null
          ? ", sort"
          : `, sorted ${direction === "asc" ? "ascending" : "descending"}`}
      </span>
    </a>
  );
}
