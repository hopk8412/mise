"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import { registerSchema, signInSchema } from "@/lib/validation/auth";

export type AuthFormState = {
  /** Problems with individual fields, keyed by field name. */
  fieldErrors?: Record<string, string[] | undefined>;
  /** A problem with the submission as a whole. */
  formError?: string;
  /** Echoed back so the form keeps what was typed. Never includes passwords. */
  values?: { name?: string; email?: string };
};

function errorCode(error: unknown): string | undefined {
  return isAPIError(error) ? (error.body as { code?: string } | undefined)?.code : undefined;
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  try {
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    switch (errorCode(error)) {
      case "INVALID_EMAIL_OR_PASSWORD":
        return { formError: "That email and password do not match an account.", values };
      case "BANNED_USER":
        return { formError: "This account has been suspended.", values };
      default:
        console.error("Sign-in failed", error);
        return { formError: "Signing in failed. Try again in a moment.", values };
    }
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const { name, email, password } = parsed.data;
  try {
    await auth.api.signUpEmail({ body: { name, email, password }, headers: await headers() });
  } catch (error) {
    switch (errorCode(error)) {
      case "USER_ALREADY_EXISTS":
      case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
        return {
          fieldErrors: { email: ["An account with this email already exists. Sign in instead."] },
          values,
        };
      default:
        console.error("Registration failed", error);
        return { formError: "Creating your account failed. Try again in a moment.", values };
    }
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
