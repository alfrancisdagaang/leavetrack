"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/login/actions";

const ROLE_OPTIONS = [
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
  { value: "hr_admin", label: "HR Admin" },
] as const;

const initialState: LoginState = { error: null };

/** Unstyled until the design export lands; semantics and a11y are final. */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} aria-describedby={state.error ? "login-error" : undefined}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <p>
        <label htmlFor="name">Name</label>
        <br />
        <input id="name" name="name" type="text" autoComplete="name" />
      </p>
      <p>
        <label htmlFor="email">Email</label>
        <br />
        <input id="email" name="email" type="email" autoComplete="email" />
      </p>
      <p>
        <label htmlFor="role">Role</label>
        <br />
        <select id="role" name="role" defaultValue="employee" required>
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </p>
      {state.error ? (
        <p id="login-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
