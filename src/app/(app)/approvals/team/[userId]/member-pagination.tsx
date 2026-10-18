import { ButtonLink } from "@/components/ui/button";
import { MEMBER_PAGE_SIZE } from "@/lib/leave/schemas";

/**
 * US-13 AC6. Previous and next links that keep the filters (the caller builds each address), and the
 * range shown. Nothing is rendered when everything fits on one page.
 */
export function MemberPagination({
  page,
  total,
  hrefFor,
  pageSize = MEMBER_PAGE_SIZE,
}: {
  page: number;
  total: number;
  hrefFor: (page: number) => string;
  /** Rows per page; the audit list shares this component with its own size. */
  pageSize?: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
    >
      {page > 1 ? (
        <ButtonLink href={hrefFor(page - 1)} variant="secondary" prefetch={false}>
          Previous
        </ButtonLink>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-ink-muted"
        >
          Previous
        </span>
      )}
      <p className="text-sm text-ink-muted">{`Showing ${from} to ${to} of ${total}`}</p>
      {page < pages ? (
        <ButtonLink href={hrefFor(page + 1)} variant="secondary" prefetch={false}>
          Next
        </ButtonLink>
      ) : (
        <span
          aria-disabled="true"
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-ink-muted"
        >
          Next
        </span>
      )}
    </nav>
  );
}
