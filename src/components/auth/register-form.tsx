"use client";

import { useActionState, useState } from "react";
import { z } from "zod";

import { FormError, FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import { registerAction, type AuthFormState } from "@/lib/actions/auth";
import { PASSWORD_MIN_LENGTH, registerSchema } from "@/lib/validation/auth";

export function RegisterForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(registerAction, {} as AuthFormState);
  const [clientErrors, setClientErrors] = useState<AuthFormState["fieldErrors"]>();
  const errors = clientErrors ?? state.fieldErrors;

  function validate(event: React.FormEvent<HTMLFormElement>) {
    const result = registerSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
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
        name="name"
        label="Name"
        autoComplete="name"
        required
        defaultValue={state.values?.name}
        errors={errors?.name}
      />
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
        autoComplete="new-password"
        required
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        errors={errors?.password}
      />
      <FormField
        name="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        required
        errors={errors?.confirmPassword}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
