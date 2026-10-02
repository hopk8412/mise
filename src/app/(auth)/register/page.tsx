import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/register-form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/safe-redirect";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage(props: PageProps<"/register">) {
  const { next: rawNext } = await props.searchParams;
  const next = typeof rawNext === "string" ? safeNextPath(rawNext, "") : "";

  if (await getSession()) {
    redirect(next || "/");
  }

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Create an account</CardTitle>
        <CardDescription>An account lets you write, save, and grade recipes.</CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm next={next || undefined} />
      </CardContent>
      <CardFooter className="text-muted-foreground border-t pt-4 text-sm">
        <p>
          Already registered?{" "}
          <Link href={loginHref} className="text-foreground font-medium underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
