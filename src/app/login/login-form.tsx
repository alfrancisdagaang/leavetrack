"use client";

import Image from "next/image";
import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/login/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordField } from "@/app/login/password-field";

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
      <Field id="email" label="Email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
      </Field>
      <PasswordField />
      {state.error ? (
        <Alert variant="error" id="login-error">
          {state.error}
        </Alert>
      ) : null}
      <Button type="submit" pending={pending} className="w-full">
        {pending ? (
          <>
            <Image
              src="/icons/loader-circle.svg"
              alt=""
              width={18}
              height={18}
              unoptimized
              className="motion-safe:animate-spin"
            />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
