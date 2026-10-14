import type { ReactNode } from "react";

export type BadgeVariant = "neutral" | "pending" | "approved" | "rejected";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-grey-100 text-grey-700",
  pending: "bg-pending-bg text-pending-fg",
  approved: "bg-approved-bg text-approved-fg",
  rejected: "bg-rejected-bg text-rejected-fg",
};

/** Status is always conveyed by the text as well as the color. */
export function Badge({
  variant = "neutral",
  children,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${VARIANTS[variant]}`}
    >
      {children}
    </span>
  );
}
