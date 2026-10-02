import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RecipeForm } from "@/components/recipes/recipe-form";
import { updateRecipeAction } from "@/lib/actions/recipes";
import { getRecipeForEdit } from "@/lib/recipes";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Edit recipe" };

export default async function EditRecipePage(props: PageProps<"/recipes/[slug]/edit">) {
  const { slug } = await props.params;
  const session = await requireSession(`/recipes/${encodeURIComponent(slug)}/edit`);

  const recipe = await getRecipeForEdit(slug, session.user);
  if (!recipe) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit recipe</h1>
      <p className="text-muted-foreground mt-2 text-sm">{recipe.values.title}</p>
      <div className="mt-8">
        <RecipeForm
          action={updateRecipeAction.bind(null, recipe.id)}
          initialValues={recipe.values}
          currentImageUrl={recipe.imageUrl}
          cancelHref={`/recipes/${recipe.slug}`}
        />
      </div>
    </main>
  );
}
