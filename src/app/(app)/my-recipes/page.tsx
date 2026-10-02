import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { listOwnRecipes } from "@/lib/recipes";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "My recipes" };

export default async function MyRecipesPage() {
  const session = await requireSession("/my-recipes");
  const recipes = await listOwnRecipes(session.user.id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">My recipes</h1>
        <Button asChild>
          <Link href="/recipes/new">
            <Plus />
            New recipe
          </Link>
        </Button>
      </div>

      {recipes.length === 0 ? (
        <div className="mt-8 grid justify-items-start gap-3 rounded-xl border border-dashed p-6">
          <p className="font-medium">You have not written any recipes yet.</p>
          <p className="text-muted-foreground text-sm">
            A recipe saved as a draft stays private until you publish it.
          </p>
          <Button asChild variant="outline">
            <Link href="/recipes/new">Write your first recipe</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {recipes.map((recipe) => (
            <li
              key={recipe.id}
              className="has-[a:focus-visible]:ring-ring/50 relative flex gap-4 rounded-xl p-3 ring-1 ring-foreground/10 has-[a:focus-visible]:ring-3"
            >
              {recipe.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={recipe.imageUrl}
                  alt=""
                  className="size-20 shrink-0 rounded-lg object-cover sm:size-24"
                />
              ) : null}
              <div className="grid min-w-0 flex-1 content-start gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="min-w-0 text-base font-medium">
                    <Link
                      href={`/recipes/${recipe.slug}`}
                      className="outline-none after:absolute after:inset-0 hover:underline"
                    >
                      {recipe.title}
                    </Link>
                  </h2>
                  <Badge variant={recipe.status === "draft" ? "secondary" : "outline"}>
                    {recipe.status === "draft" ? "Draft" : "Published"}
                  </Badge>
                </div>
                {recipe.description ? (
                  <p className="text-muted-foreground line-clamp-2 text-sm">{recipe.description}</p>
                ) : null}
                <p className="text-muted-foreground text-xs">
                  Updated{" "}
                  <time dateTime={recipe.updatedAt.toISOString()}>{formatDate(recipe.updatedAt)}</time>
                </p>
                {recipe.tags.length > 0 ? (
                  <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
                    {recipe.tags.map((tag) => (
                      <li key={tag}>
                        <Badge variant="outline">{tag}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
