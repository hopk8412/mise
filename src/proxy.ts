import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect to sign-in for routes that need a session. This only
 * checks that a session cookie is present; it does not validate it. The real
 * check is `requireSession` in each page and action, which also catches an
 * expired or revoked session that still has a cookie.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) {
    return NextResponse.next();
  }

  const url = new URL("/login", request.url);
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Every route that requires a session. Add new ones here as they are built.
  matcher: ["/my-recipes/:path*"],
};
