import { canEditRecipe, canViewRecipe } from "@/lib/authz";
import { prisma } from "@/lib/db";
import type { Session } from "@/lib/session";
import type { RecipeInput } from "@/lib/validation/recipe";

type Viewer = Session["user"];

export type RecipeDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  sourceName: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  status: "draft" | "published";
  publishedAt: Date | null;
  updatedAt: Date;
  author: { id: string; name: string };
  ingredients: { quantity: string | null; unit: string | null; name: string }[];
  steps: { text: string }[];
  tags: string[];
  canEdit: boolean;
};

export type RecipeSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  status: "draft" | "published";
  updatedAt: Date;
  publishedAt: Date | null;
  tags: string[];
};

/** The public URL of a stored recipe photo, or null when the recipe has none. */
export function recipeImageUrl(key: string | null): string | null {
  return key ? `/api/uploads/${key}` : null;
}

const byPosition = { orderBy: { position: "asc" } } as const;
const tagNames = {
  select: { tag: { select: { name: true } } },
  orderBy: { tag: { name: "asc" } },
} as const;

/**
 * A recipe for display. Returns null both when the slug matches nothing and when
 * the viewer may not see the recipe, so a draft cannot be told apart from a missing page.
 */
export async function getRecipeForViewer(
  slug: string,
  viewer: Viewer | null,
): Promise<RecipeDetail | null> {
  const recipe = await prisma.recipe.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true } },
      ingredients: byPosition,
      steps: byPosition,
      tags: tagNames,
    },
  });
  if (!recipe || !canViewRecipe(viewer, recipe)) return null;

  return {
    id: recipe.id,
    slug: recipe.slug,
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    sourceName: recipe.sourceName,
    sourceUrl: recipe.sourceUrl,
    imageUrl: recipeImageUrl(recipe.imageKey),
    status: recipe.status === "PUBLISHED" ? "published" : "draft",
    publishedAt: recipe.publishedAt,
    updatedAt: recipe.updatedAt,
    author: recipe.author,
    ingredients: recipe.ingredients.map(({ quantity, unit, name }) => ({ quantity, unit, name })),
    steps: recipe.steps.map(({ text }) => ({ text })),
    tags: recipe.tags.map(({ tag }) => tag.name),
    canEdit: canEditRecipe(viewer, recipe),
  };
}

/**
 * A recipe shaped for the edit form, or null unless the viewer may edit it.
 * Someone who can view but not edit gets null too, which the page turns into a 404.
 */
export async function getRecipeForEdit(
  slug: string,
  viewer: Viewer,
): Promise<{ id: string; slug: string; values: RecipeInput; imageUrl: string | null } | null> {
  const recipe = await prisma.recipe.findUnique({
    where: { slug },
    include: { ingredients: byPosition, steps: byPosition, tags: tagNames },
  });
  if (!recipe || !canEditRecipe(viewer, recipe)) return null;

  return {
    id: recipe.id,
    slug: recipe.slug,
    imageUrl: recipeImageUrl(recipe.imageKey),
    values: {
      title: recipe.title,
      description: recipe.description ?? undefined,
      servings: recipe.servings ?? undefined,
      prepMinutes: recipe.prepMinutes ?? undefined,
      cookMinutes: recipe.cookMinutes ?? undefined,
      sourceName: recipe.sourceName ?? undefined,
      sourceUrl: recipe.sourceUrl ?? undefined,
      ingredients: recipe.ingredients.map(({ quantity, unit, name }) => ({
        quantity: quantity ?? undefined,
        unit: unit ?? undefined,
        name,
      })),
      steps: recipe.steps.map(({ text }) => ({ text })),
      tags: recipe.tags.map(({ tag }) => tag.name),
      status: recipe.status === "PUBLISHED" ? "published" : "draft",
    },
  };
}

/** Everything one person has written, drafts included, most recently changed first. */
export async function listRecipesByAuthor(authorId: string): Promise<RecipeSummary[]> {
  const recipes = await prisma.recipe.findMany({
    where: { authorId },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    include: { tags: tagNames },
  });

  return recipes.map((recipe) => ({
    id: recipe.id,
    slug: recipe.slug,
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipeImageUrl(recipe.imageKey),
    status: recipe.status === "PUBLISHED" ? "published" : "draft",
    updatedAt: recipe.updatedAt,
    publishedAt: recipe.publishedAt,
    tags: recipe.tags.map(({ tag }) => tag.name),
  }));
}
