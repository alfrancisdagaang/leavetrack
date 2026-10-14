"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/login/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

const ROLE_OPTIONS = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "hr_admin", label: "HR Admin" },
] as const;

const initialState: LoginState = { error: null };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form
      action={formAction}
      aria-describedby={state.error ? "login-error" : undefined}
      className="space-y-4"
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field id="name" label="Name">
        <Input id="name" name="name" type="text" autoComplete="name" />
      </Field>
      <Field id="email" label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" />
      </Field>
      <Field id="role" label="Role">
        <Select id="role" name="role" defaultValue="employee" required>
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
      {state.error ? (
        <Alert variant="error" id="login-error">
          {state.error}
        </Alert>
      ) : null}
      <Button type="submit" pending={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
