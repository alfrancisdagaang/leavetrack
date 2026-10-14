import type { ReactNode } from "react";

interface CardProps {
  /** Rendered as an h2; pages own the single h1. */
  title?: string;
  children: ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <section className="rounded-card border border-grey-200 bg-white p-5 shadow-sm sm:p-6">
      {title ? <h2 className="mb-3 text-lg font-semibold text-navy-900">{title}</h2> : null}
      {children}
    </section>
  );
}
