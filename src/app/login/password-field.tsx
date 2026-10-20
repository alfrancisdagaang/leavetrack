"use client";

import { PasswordInput } from "@/components/ui/password-input";

/** The sign-in password field: one plain `password` input the login action receives as before. */
export function PasswordField() {
  return (
    <PasswordInput id="password" name="password" label="Password" autoComplete="current-password" />
  );
}
