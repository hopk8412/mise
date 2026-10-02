import { z } from "zod";

export const RECIPE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const RECIPE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const RECIPE_LIMITS = {
  title: 120,
  description: 500,
  sourceName: 120,
  sourceUrl: 2000,
  quantity: 20,
  unit: 20,
  ingredientName: 120,
  stepText: 2000,
  tag: 30,
  maxTags: 10,
  maxIngredients: 100,
  maxSteps: 100,
} as const;

// PostgreSQL text columns cannot hold NUL characters; reject them here so they surface as a
// field error instead of a failed insert. Bidirectional control characters are rejected too:
// they make text display in a different order than it is stored.
const UNSUPPORTED_CHARACTERS = /[\u0000‪-‮⁦-⁩]/;
const noNul = (value: string) => !UNSUPPORTED_CHARACTERS.test(value);
const NUL_MESSAGE = "Remove any unsupported characters, such as text direction controls.";

/** Trimmed, required text with a length limit. */
function requiredText(label: string, max: number, requiredMessage: string) {
  return z
    .string({ error: requiredMessage })
    .trim()
    .min(1, requiredMessage)
    .max(max, `Use ${max} characters or fewer for ${label}.`)
    .refine(noNul, NUL_MESSAGE);
}

/** Trimmed, optional text with a length limit. Blank input becomes undefined. */
function optionalText(label: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `Use ${max} characters or fewer for ${label}.`)
    .refine(noNul, NUL_MESSAGE)
    .nullish()
    .transform((value) => value || undefined);
}

/** An optional whole number in a range. Blank input becomes undefined. */
function optionalWholeNumber(label: string, min: number, max: number) {
  return z
    .number({ error: `Enter ${label} as a number.` })
    .int(`Enter ${label} as a whole number.`)
    .min(min, `${label[0].toUpperCase()}${label.slice(1)} must be at least ${min}.`)
    .max(max, `${label[0].toUpperCase()}${label.slice(1)} must be at most ${max}.`)
    .nullish()
    .transform((value) => value ?? undefined);
}

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const ingredientSchema = z.object({
  quantity: optionalText("the quantity", RECIPE_LIMITS.quantity),
  unit: optionalText("the unit", RECIPE_LIMITS.unit),
  name: requiredText("the ingredient name", RECIPE_LIMITS.ingredientName, "Enter the ingredient."),
});

const stepSchema = z.object({
  text: requiredText("the step", RECIPE_LIMITS.stepText, "Describe this step."),
});

// Tags are stored lowercase with runs of whitespace collapsed, so "Weeknight  Dinner"
// and "weeknight dinner" are the same tag.
const tagSchema = z
  .string({ error: "Enter a tag." })
  .transform((value) => value.trim().toLowerCase().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "Enter a tag.")
      .max(RECIPE_LIMITS.tag, `Use ${RECIPE_LIMITS.tag} characters or fewer for each tag.`)
      .refine(noNul, NUL_MESSAGE),
  );

export const recipeInputSchema = z.object({
  title: requiredText("the title", RECIPE_LIMITS.title, "Enter a title."),
  description: optionalText("the description", RECIPE_LIMITS.description),
  servings: optionalWholeNumber("servings", 1, 100),
  prepMinutes: optionalWholeNumber("prep time", 0, 1440),
  cookMinutes: optionalWholeNumber("cook time", 0, 1440),
  sourceName: optionalText("the source name", RECIPE_LIMITS.sourceName),
  sourceUrl: optionalText("the source link", RECIPE_LIMITS.sourceUrl).refine(
    (value) => value === undefined || isHttpUrl(value),
    "Enter a web address starting with http:// or https://.",
  ),
  ingredients: z
    .array(ingredientSchema, { error: "Add at least one ingredient." })
    .min(1, "Add at least one ingredient.")
    .max(RECIPE_LIMITS.maxIngredients, `Use at most ${RECIPE_LIMITS.maxIngredients} ingredients.`),
  steps: z
    .array(stepSchema, { error: "Add at least one step." })
    .min(1, "Add at least one step.")
    .max(RECIPE_LIMITS.maxSteps, `Use at most ${RECIPE_LIMITS.maxSteps} steps.`),
  tags: z
    .array(tagSchema)
    .max(RECIPE_LIMITS.maxTags, `Use at most ${RECIPE_LIMITS.maxTags} tags.`)
    .transform((tags) => [...new Set(tags)]),
  status: z.enum(["draft", "published"], { error: "Choose draft or published." }),
});

/** What the form builds and sends. */
export type RecipeInput = z.input<typeof recipeInputSchema>;
/** What the server validates it into and stores. */
export type RecipeData = z.output<typeof recipeInputSchema>;
