"use client";

import { useActionState, useState } from "react";
import { z } from "zod";

import { FormError, FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { signInAction, type AuthFormState } from "@/lib/actions/auth";
import { signInSchema } from "@/lib/validation/auth";

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signInAction, {} as AuthFormState);
  const [clientErrors, setClientErrors] = useState<AuthFormState["fieldErrors"]>();
  const errors = clientErrors ?? state.fieldErrors;

  function validate(event: React.FormEvent<HTMLFormElement>) {
    const result = signInSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (result.success) {
      setClientErrors(undefined);
    } else {
      event.preventDefault();
      setClientErrors(z.flattenError(result.error).fieldErrors);
    }
  }

  return (
    <form action={formAction} onSubmit={validate} noValidate className="grid gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormError message={clientErrors ? undefined : state.formError} />
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={errors?.email}
      />
      <FormField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        errors={errors?.password}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
