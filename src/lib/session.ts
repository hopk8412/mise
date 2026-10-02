import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/lib/auth";

/**
 * The current session, or null when signed out. Wrapped in `cache` so a layout
 * and the page under it share one lookup per request.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/**
 * The current session, redirecting to sign-in when there is none. Call it in
 * every page and server action that needs a signed-in user, not only in a
 * layout: layouts do not re-run on client navigation and do not guard actions.
 */
export async function requireSession(next?: string): Promise<Session> {
  const session = await getSession();
  if (!session) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return session;
}
