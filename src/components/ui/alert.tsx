import type { ReactNode } from "react";

export type AlertVariant = "info" | "warning" | "error";

const VARIANTS: Record<AlertVariant, string> = {
  info: "border-navy-600/30 bg-navy-50 text-navy-900",
  warning: "border-pending-fg/30 bg-pending-bg text-pending-fg",
  error: "border-rejected-fg/30 bg-rejected-bg text-rejected-fg",
};

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  id?: string;
  children: ReactNode;
}

/** Errors announce themselves to screen readers (role="alert"); other variants are plain notes. */
export function Alert({ variant = "info", title, id, children }: AlertProps) {
  return (
    <div
      id={id}
      role={variant === "error" ? "alert" : "note"}
      className={`rounded-lg border px-4 py-3 text-sm ${VARIANTS[variant]}`}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}
