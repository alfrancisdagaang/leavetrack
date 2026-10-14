import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional primary action, e.g. a ButtonLink. */
  action?: ReactNode;
}

/** The page's single h1. */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy-900">{title}</h1>
        {description ? <p className="mt-1 text-grey-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
