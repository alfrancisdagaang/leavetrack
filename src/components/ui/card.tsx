import type { ReactNode } from "react";

interface CardProps {
  /** Rendered as an h2; pages own the single h1. */
  title?: string;
  children: ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <section className="rounded-tile border border-brand-50 bg-white p-5 shadow-tile sm:p-6">
      {title ? <h2 className="mb-3 text-lg font-semibold text-ink">{title}</h2> : null}
      {children}
    </section>
  );
}
