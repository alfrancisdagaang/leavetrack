import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse";

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600",
  secondary: "border border-ink-muted bg-white text-ink hover:bg-brand-50",
  ghost: "text-brand-600 hover:bg-brand-50",
  // For use on the navy header.
  inverse: "border border-white/40 text-white hover:bg-white/10",
};

export function buttonClasses(variant: ButtonVariant = "primary"): string {
  return `${BASE} ${VARIANTS[variant]}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Shows the pending state: disables the button and sets aria-busy. */
  pending?: boolean;
}

export function Button({
  variant = "primary",
  pending = false,
  type = "button",
  disabled,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={className ? `${buttonClasses(variant)} ${className}` : buttonClasses(variant)}
      {...rest}
    />
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
}

export function ButtonLink({ variant = "primary", className, ...rest }: ButtonLinkProps) {
  return (
    <Link
      className={className ? `${buttonClasses(variant)} ${className}` : buttonClasses(variant)}
      {...rest}
    />
  );
}
