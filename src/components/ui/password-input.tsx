"use client";

import { useState, type ChangeEventHandler } from "react";
import { Field, Input } from "@/components/ui/field";

/** An eye, open or struck through. Decorative: the button carries the accessible name. */
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

interface PasswordInputProps {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  error?: string;
  /** Pass both for a controlled field; leave both out for a plain form field. */
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}

/**
 * A labelled password input with a show/hide toggle, shared by the sign-in form and the change
 * password form (and EPIC-8's set-password page). It is still one plain `password` input inside
 * its form; the toggle only changes what is drawn. Without JavaScript the field stays hidden.
 */
export function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  hint,
  error,
  value,
  onChange,
}: PasswordInputProps) {
  const [shown, setShown] = useState(false);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          required
          className="pr-12"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          {...(value !== undefined ? { value, onChange } : {})}
        />
        <button
          type="button"
          onClick={() => setShown((current) => !current)}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={shown}
          aria-controls={id}
          className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-lg text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
        >
          <EyeIcon off={shown} />
        </button>
      </div>
    </Field>
  );
}
