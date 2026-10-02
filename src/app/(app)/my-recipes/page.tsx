import type { Metadata } from "next";

import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "My recipes" };

export default async function MyRecipesPage() {
  await requireSession("/my-recipes");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">My recipes</h1>
      <p className="text-muted-foreground mt-4">You have not written any recipes yet.</p>
    </main>
  );
}
