import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/safe-redirect";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next: rawNext } = await props.searchParams;
  const next = typeof rawNext === "string" ? safeNextPath(rawNext, "") : "";

  if (await getSession()) {
    redirect(next || "/");
  }

  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Use the email and password you registered with.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm next={next || undefined} />
      </CardContent>
      <CardFooter className="text-muted-foreground border-t pt-4 text-sm">
        <p>
          No account yet?{" "}
          <Link href={registerHref} className="text-foreground font-medium underline underline-offset-4">
            Register
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
