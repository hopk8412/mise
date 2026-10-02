import { RECIPE_LIMITS, recipeInputSchema, type RecipeData } from "@/lib/validation/recipe";

export type RecipeFormState = {
  /** Problems with individual fields, keyed by dotted path: "title", "ingredients.0.name", "steps", "tags.2". */
  fieldErrors?: Record<string, string[] | undefined>;
  /** A problem with the submission as a whole. */
  formError?: string;
};

export type ParsedRecipeForm = { ok: true; data: RecipeData } | { ok: false; state: RecipeFormState };

// A legitimate recipe is far smaller than this: the schema's own limits add up to well under 1 MB.
const MAX_DATA_CHARS = 1_500_000;
// Stops a hostile payload from producing an unbounded error response.
const MAX_REPORTED_ISSUES = 50;

const UNREADABLE = "The recipe could not be read. Reload the page and try again.";
const CHECK_FORM = "Check the highlighted fields and try again.";

const ARRAY_LIMITS = [
  ["ingredients", RECIPE_LIMITS.maxIngredients, "ingredients"],
  ["steps", RECIPE_LIMITS.maxSteps, "steps"],
  ["tags", RECIPE_LIMITS.maxTags, "tags"],
] as const;

/**
 * Reads the `data` field of the recipe form and validates it. Never throws on bad input.
 *
 * Zod parses every array element before it applies the array's length limit, so an oversized
 * array would cost memory and time in proportion to its length. The size and length checks
 * here run first to keep that bounded.
 */
export function parseRecipeForm(formData: unknown): ParsedRecipeForm {
  if (!(formData instanceof FormData)) return { ok: false, state: { formError: UNREADABLE } };

  const raw = formData.get("data");
  if (typeof raw !== "string" || raw.length > MAX_DATA_CHARS) {
    return { ok: false, state: { formError: UNREADABLE } };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, state: { formError: UNREADABLE } };
  }

  if (typeof json === "object" && json !== null) {
    const tooLong: Record<string, string[]> = {};
    for (const [key, max, noun] of ARRAY_LIMITS) {
      const value = (json as Record<string, unknown>)[key];
      if (Array.isArray(value) && value.length > max) {
        tooLong[key] = [`Use at most ${max} ${noun}.`];
      }
    }
    if (Object.keys(tooLong).length > 0) {
      return { ok: false, state: { fieldErrors: tooLong, formError: CHECK_FORM } };
    }
  }

  const parsed = recipeInputSchema.safeParse(json);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: Record<string, string[]> = {};
  let formError: string | undefined;
  for (const issue of parsed.error.issues.slice(0, MAX_REPORTED_ISSUES)) {
    const key = issue.path.map(String).join(".");
    if (!key) {
      formError = UNREADABLE;
      continue;
    }
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return {
    ok: false,
    state: {
      fieldErrors,
      formError: formError ?? (Object.keys(fieldErrors).length > 0 ? CHECK_FORM : undefined),
    },
  };
}
