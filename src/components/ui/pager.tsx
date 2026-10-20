import Link from "next/link";

/** Page numbers to show: the first, the last, and the pages next to the current one, with gaps as null. */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  const shown = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const [i, n] of shown.entries()) {
    if (i > 0 && n - shown[i - 1]! > 1) out.push(null);
    out.push(n);
  }
  return out;
}

const LINK =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm font-semibold";

/**
 * "Showing 1 to 25 of 1,248", Previous and Next, and numbered pages with the current one marked. Every
 * link keeps the search, filters and order (the caller builds each address). Only the range for a single page.
 * Shared by Leave Policies, Team Approvals and Balance Overrides.
 */
export function Pager({
  page,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
    >
      <p className="text-sm text-ink-muted">
        Showing {fmt(from)} to {fmt(to)} of {fmt(total)}
      </p>
      {pages > 1 ? (
        <ul className="flex flex-wrap items-center gap-1.5">
          <li>
            {page > 1 ? (
              <Link
                href={hrefFor(page - 1)}
                prefetch={false}
                className={`${LINK} border-line bg-white text-ink hover:bg-brand-50`}
              >
                Previous
              </Link>
            ) : (
              <span aria-disabled="true" className={`${LINK} border-line text-ink-muted`}>
                Previous
              </span>
            )}
          </li>
          {pageWindow(page, pages).map((n, i) =>
            n === null ? (
              <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-ink-muted">
                …
              </li>
            ) : (
              <li key={n}>
                {n === page ? (
                  <span
                    aria-current="page"
                    className={`${LINK} border-brand-500 bg-brand-500 text-white`}
                  >
                    <span className="sr-only">Page </span>
                    {n}
                  </span>
                ) : (
                  <Link
                    href={hrefFor(n)}
                    prefetch={false}
                    className={`${LINK} border-line bg-white text-ink hover:bg-brand-50`}
                  >
                    <span className="sr-only">Page </span>
                    {n}
                  </Link>
                )}
              </li>
            ),
          )}
          <li>
            {page < pages ? (
              <Link
                href={hrefFor(page + 1)}
                prefetch={false}
                className={`${LINK} border-line bg-white text-ink hover:bg-brand-50`}
              >
                Next
              </Link>
            ) : (
              <span aria-disabled="true" className={`${LINK} border-line text-ink-muted`}>
                Next
              </span>
            )}
          </li>
        </ul>
      ) : null}
    </nav>
  );
}
