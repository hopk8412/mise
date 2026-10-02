import { requireSession } from "@/lib/session";

/**
 * Routes that need a signed-in user. The check here covers the initial render;
 * each page and action under this group still calls `requireSession` itself.
 */
export default async function SignedInLayout({ children }: LayoutProps<"/">) {
  await requireSession();
  return children;
}
