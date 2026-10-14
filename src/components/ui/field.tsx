import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const CONTROL =
  "block min-h-11 w-full rounded-lg border border-grey-500 bg-white px-3 py-2 text-base text-grey-900 placeholder:text-grey-500 aria-[invalid=true]:border-rejected-fg";

interface FieldProps {
  /** Must match the `id` of the control passed as children. */
  id: string;
  label: string;
  hint?: string;
  /** Pair with `aria-describedby={`${id}-error`}` and `aria-invalid` on the control. */
  error?: string;
  children: ReactNode;
}

/** A label, a control and optional hint/error text. Every input in the app goes through this. */
export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-grey-900">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-grey-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-rejected-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={className ? `${CONTROL} ${className}` : CONTROL} {...rest} />;
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={className ? `${CONTROL} ${className}` : CONTROL} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={className ? `${CONTROL} ${className}` : CONTROL} {...rest} />;
}
