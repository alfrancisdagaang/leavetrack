"use client";

import { useActionState } from "react";
import { mockLoginAction, type LoginState } from "@/app/login/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

const ROLE_OPTIONS = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "hr_admin", label: "HR Admin" },
] as const;

const initialState: LoginState = { error: null };

/** ⚠ MOCK AUTH (ADR-LeaveTrack-E001): rendered only while ALLOW_MOCK_LOGIN is true. */
export function MockLoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(mockLoginAction, initialState);

  return (
    <form
      action={formAction}
      aria-describedby={state.error ? "mock-login-error" : undefined}
      className="space-y-4"
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field id="mock-name" label="Name">
        <Input id="mock-name" name="name" type="text" autoComplete="off" />
      </Field>
      <Field id="mock-email" label="Email">
        <Input id="mock-email" name="email" type="email" autoComplete="off" />
      </Field>
      <Field id="mock-role" label="Role">
        <Select id="mock-role" name="role" defaultValue="employee" required>
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      {state.error ? (
        <Alert variant="error" id="mock-login-error">
          {state.error}
        </Alert>
      ) : null}
      <Button type="submit" pending={pending} className="w-full">
        {pending ? "Signing in…" : "Continue with mock sign-in"}
      </Button>
    </form>
  );
}
