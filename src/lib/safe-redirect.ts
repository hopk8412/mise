/**
 * Returns `next` if it is a path on this site, otherwise `fallback`. Used for the
 * `?next=` parameter carried through sign-in, which arrives from the URL and so
 * must not be able to send someone to another origin.
 */
export function safeNextPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;
  // "//host" and "/\host" are protocol-relative URLs to browsers.
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // Never bounce back to a sign-in page after signing in.
  if (/^\/(login|register)(?:[/?#]|$)/.test(next)) return fallback;
  return next;
}
