"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import type { Prisma, RecipeStatus } from "@/generated/prisma/client";
import { canEditRecipe, canViewRecipe } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { checkImageUpload } from "@/lib/images";
import { parseRecipeForm, type RecipeFormState } from "@/lib/recipe-form";
import { createSlug } from "@/lib/slug";
import { newRecipeImageKey, storage } from "@/lib/storage";
import type { RecipeData } from "@/lib/validation/recipe";

export type { RecipeFormState };

const SAVE_FAILED = "Saving the recipe failed. Try again in a moment.";
const MAX_ATTEMPTS = 5;

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

/** Re-runs a whole transaction when it loses a race on a unique value (a slug or a new tag). */
async function withUniqueRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (errorCode(error) !== "P2002" || attempt >= MAX_ATTEMPTS) throw error;
    }
  }
}

/** Finds or creates each tag and returns the ids, in order. */
async function resolveTagIds(tx: Prisma.TransactionClient, names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const tag = await tx.tag.upsert({
      where: { name },
      create: { name },
      update: {},
      select: { id: true },
    });
    ids.push(tag.id);
  }
  return ids;
}

function publication(
  status: RecipeData["status"],
  current: { status: RecipeStatus; publishedAt: Date | null } | null,
): { status: RecipeStatus; publishedAt: Date | null } {
  if (status === "draft") return { status: "DRAFT", publishedAt: null };
  // The first publication date survives later edits; unpublishing and publishing again restarts it.
  const keep = current?.status === "PUBLISHED" ? current.publishedAt : null;
  return { status: "PUBLISHED", publishedAt: keep ?? new Date() };
}

function ingredientRows(data: RecipeData) {
  return data.ingredients.map(({ quantity, unit, name }, position) => ({
    position,
    quantity: quantity ?? null,
    unit: unit ?? null,
    name,
  }));
}

function stepRows(data: RecipeData) {
  return data.steps.map(({ text }, position) => ({ position, text }));
}

type PendingImage = { key: string; bytes: Uint8Array; contentType: string };

/** Validates a chosen photo without writing anything. A null file means "no change". */
async function checkImage(
  image: File | null,
): Promise<{ pending: PendingImage | null } | { state: RecipeFormState }> {
  if (!image) return { pending: null };
  const checked = await checkImageUpload(image);
  if (!checked.ok) return { state: { fieldErrors: { image: [checked.error] } } };
  return {
    pending: {
      key: newRecipeImageKey(checked.kind),
      bytes: checked.bytes,
      contentType: checked.kind.contentType,
    },
  };
}

/** Writes a validated photo to storage. Returns an error state when that fails. */
async function writeImage(pending: PendingImage): Promise<RecipeFormState | null> {
  try {
    await storage.put(pending.key, pending.bytes, pending.contentType);
    return null;
  } catch (error) {
    console.error("Saving an uploaded image failed", error);
    return { fieldErrors: { image: ["The image could not be saved. Try again in a moment."] } };
  }
}

/** Removes a stored photo that no recipe refers to any more. A failure leaves an orphan file, nothing worse. */
async function discardImage(key: string | null | undefined): Promise<void> {
  if (!key) return;
  try {
    await storage.delete(key);
  } catch (error) {
    console.error("Removing a stored image failed", error);
  }
}

/**
 * Ends an action that touched a recipe the viewer may not change. A recipe they cannot see
 * is reported as missing so its existence is not revealed; one they can see (a published
 * recipe by someone else) is refused outright.
 */
function refuse(
  viewer: { id: string; role?: string | null },
  recipe: { authorId: string; status: RecipeStatus } | null,
): never {
  if (!recipe || !canViewRecipe(viewer, recipe)) notFound();
  throw new Error("You can only change your own recipes.");
}

export async function createRecipeAction(
  _previous: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  const session = await requireSession("/recipes/new");

  const parsed = parseRecipeForm(formData);
  if (!parsed.ok) return parsed.state;
  const { data } = parsed;

  const checked = await checkImage(parsed.image);
  if ("state" in checked) return checked.state;
  const pending = checked.pending;
  if (pending) {
    const failed = await writeImage(pending);
    if (failed) return failed;
  }

  let slug: string;
  try {
    slug = await withUniqueRetry(async () => {
      const candidate = createSlug(data.title);
      await prisma.$transaction(async (tx) => {
        const tagIds = await resolveTagIds(tx, data.tags);
        await tx.recipe.create({
          data: {
            slug: candidate,
            title: data.title,
            description: data.description ?? null,
            servings: data.servings ?? null,
            prepMinutes: data.prepMinutes ?? null,
            cookMinutes: data.cookMinutes ?? null,
            sourceName: data.sourceName ?? null,
            sourceUrl: data.sourceUrl ?? null,
            imageKey: pending?.key ?? null,
            authorId: session.user.id,
            ...publication(data.status, null),
            ingredients: { createMany: { data: ingredientRows(data) } },
            steps: { createMany: { data: stepRows(data) } },
            tags: { createMany: { data: tagIds.map((tagId) => ({ tagId })) } },
          },
        });
      });
      return candidate;
    });
  } catch (error) {
    console.error("Creating a recipe failed", error);
    await discardImage(pending?.key);
    return { formError: SAVE_FAILED };
  }

  revalidatePath("/my-recipes");
  redirect(`/recipes/${slug}`);
}

export async function updateRecipeAction(
  recipeId: string,
  _previous: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  const session = await requireSession();
  if (typeof recipeId !== "string") notFound();

  const existing = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, slug: true, authorId: true, status: true },
  });
  if (!existing || !canViewRecipe(session.user, existing)) notFound();
  if (!canEditRecipe(session.user, existing)) {
    return { formError: "You can only edit your own recipes." };
  }

  const parsed = parseRecipeForm(formData);
  if (!parsed.ok) return parsed.state;
  const { data } = parsed;

  const checked = await checkImage(parsed.image);
  if ("state" in checked) return checked.state;
  const pending = checked.pending;
  if (pending) {
    const failed = await writeImage(pending);
    if (failed) return failed;
  }

  // The photo this edit replaces or clears, as read inside the transaction.
  let previousKey: string | null = null;
  let missing = false;
  try {
    await withUniqueRetry(() =>
      prisma.$transaction(async (tx) => {
        // Touching the row first takes its lock, so two edits of one recipe run one after the
        // other instead of interleaving their deletes and inserts. It also returns the
        // publication state as it is now rather than as it was when this request began.
        const current = await tx.recipe.update({
          where: { id: existing.id },
          data: { title: data.title },
          select: { status: true, publishedAt: true, imageKey: true },
        });
        previousKey = current.imageKey;
        const tagIds = await resolveTagIds(tx, data.tags);

        await tx.ingredient.deleteMany({ where: { recipeId: existing.id } });
        await tx.step.deleteMany({ where: { recipeId: existing.id } });
        await tx.recipeTag.deleteMany({ where: { recipeId: existing.id } });

        await tx.recipe.update({
          where: { id: existing.id },
          data: {
            description: data.description ?? null,
            servings: data.servings ?? null,
            prepMinutes: data.prepMinutes ?? null,
            cookMinutes: data.cookMinutes ?? null,
            sourceName: data.sourceName ?? null,
            sourceUrl: data.sourceUrl ?? null,
            ...publication(data.status, current),
            ...(pending ? { imageKey: pending.key } : parsed.removeImage ? { imageKey: null } : {}),
            ingredients: { createMany: { data: ingredientRows(data) } },
            steps: { createMany: { data: stepRows(data) } },
            tags: { createMany: { data: tagIds.map((tagId) => ({ tagId })) } },
          },
        });
      }),
    );
  } catch (error) {
    await discardImage(pending?.key);
    // P2025: the recipe was deleted between the check above and the write.
    if (errorCode(error) === "P2025") {
      missing = true;
    } else {
      console.error("Updating a recipe failed", error);
      return { formError: SAVE_FAILED };
    }
  }
  if (missing) notFound();

  // Only now that the new state is committed is the old file safe to remove.
  if (pending || parsed.removeImage) await discardImage(previousKey);

  revalidatePath(`/recipes/${existing.slug}`);
  revalidatePath("/my-recipes");
  redirect(`/recipes/${existing.slug}`);
}

export async function deleteRecipeAction(recipeId: string): Promise<void> {
  const session = await requireSession();
  if (typeof recipeId !== "string") notFound();

  const existing = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, slug: true, authorId: true, status: true },
  });
  if (!existing || !canEditRecipe(session.user, existing)) refuse(session.user, existing);

  try {
    // Ingredients, steps and tag links go with it through the foreign keys' cascade.
    const deleted = await prisma.recipe.delete({
      where: { id: existing.id },
      select: { imageKey: true },
    });
    await discardImage(deleted.imageKey);
  } catch (error) {
    // Already gone: the outcome the caller wanted.
    if (errorCode(error) !== "P2025") throw error;
  }

  revalidatePath(`/recipes/${existing.slug}`);
  revalidatePath("/my-recipes");
  redirect("/my-recipes");
}

export async function setRecipeStatusAction(
  recipeId: string,
  status: "draft" | "published",
): Promise<void> {
  const session = await requireSession();
  if (typeof recipeId !== "string") notFound();
  if (status !== "draft" && status !== "published") throw new Error("Unknown recipe status.");

  const existing = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, slug: true, authorId: true, status: true, publishedAt: true },
  });
  if (!existing || !canEditRecipe(session.user, existing)) refuse(session.user, existing);

  const next = publication(status, existing);
  if (next.status !== existing.status) {
    try {
      await prisma.recipe.update({ where: { id: existing.id }, data: next });
    } catch (error) {
      if (errorCode(error) === "P2025") notFound();
      throw error;
    }
  }

  revalidatePath(`/recipes/${existing.slug}`);
  revalidatePath("/my-recipes");
}
