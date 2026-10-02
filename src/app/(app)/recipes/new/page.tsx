import type { Metadata } from "next";

import { RecipeForm } from "@/components/recipes/recipe-form";
import { createRecipeAction } from "@/lib/actions/recipes";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "New recipe" };

export default async function NewRecipePage() {
  await requireSession("/recipes/new");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">New recipe</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Add the ingredients and steps, then save it as a draft or publish it.
      </p>
      <div className="mt-8">
        <RecipeForm action={createRecipeAction} cancelHref="/my-recipes" />
      </div>
    </main>
  );
}
