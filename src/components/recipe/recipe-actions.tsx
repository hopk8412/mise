import { EyeOff, Pencil, Send } from "lucide-react";
import Link from "next/link";

import { DeleteRecipeButton } from "@/components/recipe/delete-recipe-button";
import { Button } from "@/components/ui/button";
import { setRecipeStatusAction } from "@/lib/actions/recipes";

/** Edit, publish or unpublish, and delete. Rendered only for viewers who can edit the recipe. */
export function RecipeActions({
  recipeId,
  slug,
  title,
  status,
}: {
  recipeId: string;
  slug: string;
  title: string;
  status: "draft" | "published";
}) {
  const publishing = status === "draft";

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Recipe actions">
      <Button asChild variant="outline" size="sm">
        <Link href={`/recipes/${slug}/edit`}>
          <Pencil />
          Edit
        </Link>
      </Button>
      <form action={setRecipeStatusAction.bind(null, recipeId, publishing ? "published" : "draft")}>
        <Button type="submit" variant="outline" size="sm">
          {publishing ? <Send /> : <EyeOff />}
          {publishing ? "Publish" : "Move to drafts"}
        </Button>
      </form>
      <DeleteRecipeButton recipeId={recipeId} title={title} />
    </div>
  );
}
