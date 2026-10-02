import { Plus } from "lucide-react";
import Link from "next/link";

import { UserMenu } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/session";

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          mise
        </Link>
        <nav aria-label="Account" className="flex items-center gap-2">
          {session ? (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/recipes/new">
                  <Plus />
                  New recipe
                </Link>
              </Button>
              <UserMenu name={session.user.name} email={session.user.email} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Register</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
