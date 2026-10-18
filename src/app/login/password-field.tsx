"use client";

import { useState } from "react";
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

/**
 * The sign-in password field with a show/hide toggle. It is still one plain `password` input named
 * `password` inside the form, so the server action receives it as before; the toggle only changes
 * what is drawn on screen. Without JavaScript the toggle does nothing and the field stays hidden.
 */
export function PasswordField() {
  const [shown, setShown] = useState(false);
  return (
    <Field id="password" label="Password">
      <div className="relative">
        <Input
          id="password"
          name="password"
          type={shown ? "text" : "password"}
          autoComplete="current-password"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setShown((value) => !value)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          aria-controls="password"
          className="absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-lg text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500"
        >
          <EyeIcon off={shown} />
        </button>
      </div>
    </Field>
  );
}
