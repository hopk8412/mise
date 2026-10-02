"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { z } from "zod";

import { FormError } from "@/components/auth/form-field";
import { Field } from "@/components/recipes/field";
import { ImagePicker } from "@/components/recipes/image-picker";
import { RowControls } from "@/components/recipes/row-controls";
import { normalizeTag, TagInput } from "@/components/recipes/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { RecipeFormState } from "@/lib/recipe-form";
import { RECIPE_LIMITS, recipeInputSchema, type RecipeInput } from "@/lib/validation/recipe";

type FieldErrors = Record<string, string[]>;
type IngredientRow = { key: string; quantity: string; unit: string; name: string };
type StepRow = { key: string; text: string };

const INITIAL_STATE: RecipeFormState = {};
const CHECK_FORM = "Check the highlighted fields and try again.";

type RecipeFormProps = {
  /** The create action, or the update action with the recipe id already bound. */
  action: (previous: RecipeFormState, formData: FormData) => Promise<RecipeFormState>;
  /** Present when editing. */
  initialValues?: RecipeInput;
  /** Address of the recipe's current image, when editing. */
  currentImageUrl?: string | null;
  /** Where "Cancel" goes. */
  cancelHref: string;
};

function toText(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

/** Blank becomes undefined; anything else becomes a number, which may be NaN and so fail validation. */
function toNumber(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}

function moved<T>(rows: T[], from: number, to: number) {
  const next = [...rows];
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}

function collectErrors(issues: z.core.$ZodIssue[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    (errors[issue.path.map(String).join(".")] ??= []).push(issue.message);
  }
  return errors;
}

function withoutErrors(errors: FieldErrors, prefix: string) {
  return Object.fromEntries(
    Object.entries(errors).filter(([key]) => key !== prefix && !key.startsWith(`${prefix}.`)),
  );
}

export function RecipeForm({ action, initialValues, currentImageUrl, cancelHref }: RecipeFormProps) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [servings, setServings] = useState(toText(initialValues?.servings));
  const [prepMinutes, setPrepMinutes] = useState(toText(initialValues?.prepMinutes));
  const [cookMinutes, setCookMinutes] = useState(toText(initialValues?.cookMinutes));
  const [sourceName, setSourceName] = useState(initialValues?.sourceName ?? "");
  const [sourceUrl, setSourceUrl] = useState(initialValues?.sourceUrl ?? "");
  const [ingredients, setIngredients] = useState<IngredientRow[]>(() =>
    (initialValues?.ingredients.length
      ? initialValues.ingredients
      : [{ quantity: "", unit: "", name: "" }]
    ).map((row, index) => ({
      key: `i${index}`,
      quantity: row.quantity ?? "",
      unit: row.unit ?? "",
      name: row.name,
    })),
  );
  const [steps, setSteps] = useState<StepRow[]>(() =>
    (initialValues?.steps.length ? initialValues.steps : [{ text: "" }]).map((row, index) => ({
      key: `s${index}`,
      text: row.text,
    })),
  );
  const [tags, setTags] = useState<string[]>(initialValues?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [status, setStatus] = useState<RecipeInput["status"]>(initialValues?.status ?? "draft");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [seenState, setSeenState] = useState(state);
  const [focusTick, setFocusTick] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const formRef = useRef<HTMLFormElement>(null);
  const errorBoxRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const nextKey = useRef(0);

  // A response from the server replaces the errors on screen. Everything typed stays in state.
  if (state !== seenState) {
    setSeenState(state);
    setErrors(
      Object.fromEntries(
        Object.entries(state.fieldErrors ?? {}).filter(
          (entry): entry is [string, string[]] => entry[1] !== undefined && entry[1].length > 0,
        ),
      ),
    );
    setFormError(state.formError);
  }

  // After a failed submit, move to the first field with a problem.
  useEffect(() => {
    if (state === INITIAL_STATE && focusTick === 0) return;
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    (invalid ?? errorBoxRef.current)?.focus();
  }, [state, focusTick]);

  // After a row is added, moved or removed, put focus back where the user was working.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    formRef.current?.querySelector<HTMLElement>(`[data-focus-id="${id}"]`)?.focus();
  }, [ingredients, steps]);

  function clearError(key: string) {
    setErrors((current) => (key in current ? withoutErrors(current, key) : current));
  }

  function newKey(prefix: string) {
    nextKey.current += 1;
    return `${prefix}n${nextKey.current}`;
  }

  // Ingredients

  function updateIngredient(index: number, patch: Partial<Omit<IngredientRow, "key">>) {
    setIngredients((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    for (const field of Object.keys(patch)) clearError(`ingredients.${index}.${field}`);
  }

  function addIngredient() {
    if (ingredients.length >= RECIPE_LIMITS.maxIngredients) return;
    const key = newKey("i");
    setIngredients([...ingredients, { key, quantity: "", unit: "", name: "" }]);
    pendingFocus.current = `ingredient-${key}-field`;
    setErrors((current) => withoutErrors(current, "ingredients"));
    setAnnouncement(`Ingredient ${ingredients.length + 1} added.`);
  }

  function moveIngredient(index: number, direction: "up" | "down") {
    const to = direction === "up" ? index - 1 : index + 1;
    if (to < 0 || to >= ingredients.length) return;
    // Keep focus on the button that was used, or its neighbour when it has just become unavailable.
    const edge = to === 0 ? "down" : to === ingredients.length - 1 ? "up" : direction;
    pendingFocus.current = `ingredient-${ingredients[index].key}-${edge}`;
    setIngredients(moved(ingredients, index, to));
    setErrors((current) => withoutErrors(current, "ingredients"));
    setAnnouncement(`Ingredient moved ${direction} to position ${to + 1} of ${ingredients.length}.`);
  }

  function removeIngredient(index: number) {
    if (ingredients.length <= 1) return;
    const neighbour = ingredients[index + 1] ?? ingredients[index - 1];
    pendingFocus.current = `ingredient-${neighbour.key}-field`;
    setIngredients(ingredients.filter((_, i) => i !== index));
    setErrors((current) => withoutErrors(current, "ingredients"));
    setAnnouncement(`Ingredient ${index + 1} removed.`);
  }

  // Steps

  function updateStep(index: number, text: string) {
    setSteps((rows) => rows.map((row, i) => (i === index ? { ...row, text } : row)));
    clearError(`steps.${index}.text`);
  }

  function addStep() {
    if (steps.length >= RECIPE_LIMITS.maxSteps) return;
    const key = newKey("s");
    setSteps([...steps, { key, text: "" }]);
    pendingFocus.current = `step-${key}-field`;
    setErrors((current) => withoutErrors(current, "steps"));
    setAnnouncement(`Step ${steps.length + 1} added.`);
  }

  function moveStep(index: number, direction: "up" | "down") {
    const to = direction === "up" ? index - 1 : index + 1;
    if (to < 0 || to >= steps.length) return;
    const edge = to === 0 ? "down" : to === steps.length - 1 ? "up" : direction;
    pendingFocus.current = `step-${steps[index].key}-${edge}`;
    setSteps(moved(steps, index, to));
    setErrors((current) => withoutErrors(current, "steps"));
    setAnnouncement(`Step moved ${direction} to position ${to + 1} of ${steps.length}.`);
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return;
    const neighbour = steps[index + 1] ?? steps[index - 1];
    pendingFocus.current = `step-${neighbour.key}-field`;
    setSteps(steps.filter((_, i) => i !== index));
    setErrors((current) => withoutErrors(current, "steps"));
    setAnnouncement(`Step ${index + 1} removed.`);
  }

  // Submitting

  function buildInput(): RecipeInput {
    // Text still sitting in the tag box counts as a tag.
    const pendingTag = normalizeTag(tagDraft);
    const allTags = pendingTag && !tags.includes(pendingTag) ? [...tags, pendingTag] : tags;

    return {
      title,
      description,
      servings: toNumber(servings),
      prepMinutes: toNumber(prepMinutes),
      cookMinutes: toNumber(cookMinutes),
      sourceName,
      sourceUrl,
      ingredients: ingredients.map(({ quantity, unit, name }) => ({ quantity, unit, name })),
      steps: steps.map(({ text }) => ({ text })),
      tags: allTags,
      status,
    };
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const input = buildInput();
    const result = recipeInputSchema.safeParse(input);
    if (!result.success) {
      setErrors(collectErrors(result.error.issues));
      setFormError(CHECK_FORM);
      setFocusTick((tick) => tick + 1);
      return;
    }

    setErrors({});
    setFormError(undefined);

    const formData = new FormData();
    formData.set("data", JSON.stringify(input));
    if (imageFile) {
      formData.set("image", imageFile);
    } else if (removeImage && currentImageUrl) {
      formData.set("removeImage", "on");
    }
    startTransition(() => formAction(formData));
  }

  const tagErrors = Object.entries(errors)
    .filter(([key]) => key === "tags" || key.startsWith("tags."))
    .flatMap(([, messages]) => messages);

  const submitLabel =
    status === "draft"
      ? "Save draft"
      : initialValues?.status === "published"
        ? "Save changes"
        : "Publish recipe";

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="grid gap-10">
      <div ref={errorBoxRef} tabIndex={-1} className="outline-none empty:hidden">
        <FormError message={formError} />
      </div>

      <section aria-labelledby="basics-heading" className="grid gap-4">
        <h2 id="basics-heading" className="text-lg font-semibold">
          Basics
        </h2>
        <Field id="recipe-title" label="Title" errors={errors.title}>
          {(control) => (
            <Input
              {...control}
              value={title}
              required
              onChange={(event) => {
                setTitle(event.target.value);
                clearError("title");
              }}
            />
          )}
        </Field>
        <Field
          id="recipe-description"
          label="Description"
          hint="Optional. A sentence or two about the dish."
          errors={errors.description}
        >
          {(control) => (
            <Textarea
              {...control}
              rows={3}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                clearError("description");
              }}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="recipe-servings" label="Servings" errors={errors.servings}>
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                value={servings}
                onChange={(event) => {
                  setServings(event.target.value);
                  clearError("servings");
                }}
              />
            )}
          </Field>
          <Field id="recipe-prep" label="Prep time (minutes)" errors={errors.prepMinutes}>
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                value={prepMinutes}
                onChange={(event) => {
                  setPrepMinutes(event.target.value);
                  clearError("prepMinutes");
                }}
              />
            )}
          </Field>
          <Field id="recipe-cook" label="Cook time (minutes)" errors={errors.cookMinutes}>
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                value={cookMinutes}
                onChange={(event) => {
                  setCookMinutes(event.target.value);
                  clearError("cookMinutes");
                }}
              />
            )}
          </Field>
        </div>
      </section>

      <section aria-labelledby="image-heading" className="grid gap-4">
        <h2 id="image-heading" className="text-lg font-semibold">
          Image
        </h2>
        <ImagePicker
          id="recipe-image"
          currentUrl={currentImageUrl}
          removeCurrent={removeImage}
          onRemoveCurrentChange={setRemoveImage}
          onFileChange={(file) => {
            setImageFile(file);
            clearError("image");
          }}
          errors={errors.image}
        />
      </section>

      <section aria-labelledby="ingredients-heading" className="grid gap-4">
        <h2 id="ingredients-heading" className="text-lg font-semibold">
          Ingredients
        </h2>
        {errors.ingredients ? (
          <p className="text-destructive text-sm">{errors.ingredients[0]}</p>
        ) : null}
        <ol className="grid gap-3">
          {ingredients.map((row, index) => {
            const number = index + 1;
            const rowErrors = [
              errors[`ingredients.${index}.quantity`]?.[0],
              errors[`ingredients.${index}.unit`]?.[0],
              errors[`ingredients.${index}.name`]?.[0],
            ].filter(Boolean);
            const errorId = rowErrors.length ? `ingredient-${row.key}-error` : undefined;
            return (
              <li key={row.key} className="grid gap-2 max-sm:rounded-lg max-sm:border max-sm:p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-[5.5rem_6.5rem_minmax(0,1fr)]">
                    <Input
                      data-focus-id={`ingredient-${row.key}-field`}
                      aria-label={`Ingredient ${number} quantity`}
                      placeholder="Quantity"
                      value={row.quantity}
                      aria-invalid={errors[`ingredients.${index}.quantity`] ? true : undefined}
                      aria-describedby={errors[`ingredients.${index}.quantity`] ? errorId : undefined}
                      onChange={(event) => updateIngredient(index, { quantity: event.target.value })}
                    />
                    <Input
                      aria-label={`Ingredient ${number} unit`}
                      placeholder="Unit"
                      value={row.unit}
                      aria-invalid={errors[`ingredients.${index}.unit`] ? true : undefined}
                      aria-describedby={errors[`ingredients.${index}.unit`] ? errorId : undefined}
                      onChange={(event) => updateIngredient(index, { unit: event.target.value })}
                    />
                    <Input
                      aria-label={`Ingredient ${number} name`}
                      placeholder="Ingredient"
                      className="col-span-2 sm:col-span-1"
                      value={row.name}
                      aria-invalid={errors[`ingredients.${index}.name`] ? true : undefined}
                      aria-describedby={errors[`ingredients.${index}.name`] ? errorId : undefined}
                      onChange={(event) => updateIngredient(index, { name: event.target.value })}
                    />
                  </div>
                  <RowControls
                    noun="ingredient"
                    index={index}
                    count={ingredients.length}
                    focusKey={`ingredient-${row.key}`}
                    onMove={(direction) => moveIngredient(index, direction)}
                    onRemove={() => removeIngredient(index)}
                  />
                </div>
                {errorId ? (
                  <p id={errorId} className="text-destructive text-xs">
                    {rowErrors.join(" ")}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={addIngredient}
            disabled={ingredients.length >= RECIPE_LIMITS.maxIngredients}
          >
            <Plus aria-hidden="true" />
            Add ingredient
          </Button>
        </div>
      </section>

      <section aria-labelledby="steps-heading" className="grid gap-4">
        <h2 id="steps-heading" className="text-lg font-semibold">
          Steps
        </h2>
        {errors.steps ? <p className="text-destructive text-sm">{errors.steps[0]}</p> : null}
        <ol className="grid gap-4">
          {steps.map((row, index) => {
            const number = index + 1;
            const stepErrors = errors[`steps.${index}.text`];
            const errorId = stepErrors ? `step-${row.key}-error` : undefined;
            return (
              <li key={row.key} className="grid gap-2 max-sm:rounded-lg max-sm:border max-sm:p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <label htmlFor={`step-${row.key}`} className="text-sm font-medium">
                      Step {number}
                    </label>
                    <Textarea
                      id={`step-${row.key}`}
                      data-focus-id={`step-${row.key}-field`}
                      rows={3}
                      value={row.text}
                      aria-invalid={stepErrors ? true : undefined}
                      aria-describedby={errorId}
                      onChange={(event) => updateStep(index, event.target.value)}
                    />
                  </div>
                  <div className="sm:pt-6">
                    <RowControls
                      noun="step"
                      index={index}
                      count={steps.length}
                      focusKey={`step-${row.key}`}
                      onMove={(direction) => moveStep(index, direction)}
                      onRemove={() => removeStep(index)}
                    />
                  </div>
                </div>
                {errorId ? (
                  <p id={errorId} className="text-destructive text-xs">
                    {stepErrors![0]}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={addStep}
            disabled={steps.length >= RECIPE_LIMITS.maxSteps}
          >
            <Plus aria-hidden="true" />
            Add step
          </Button>
        </div>
      </section>

      <section aria-labelledby="tags-heading" className="grid gap-4">
        <h2 id="tags-heading" className="text-lg font-semibold">
          Tags
        </h2>
        <TagInput
          id="recipe-tags"
          tags={tags}
          draft={tagDraft}
          onTagsChange={(next) => {
            setTags(next);
            clearError("tags");
          }}
          onDraftChange={setTagDraft}
          errors={tagErrors}
        />
      </section>

      <section aria-labelledby="source-heading" className="grid gap-4">
        <h2 id="source-heading" className="text-lg font-semibold">
          Source
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="recipe-source-name"
            label="Source name"
            hint="Optional. A cookbook, a website or a person."
            errors={errors.sourceName}
          >
            {(control) => (
              <Input
                {...control}
                value={sourceName}
                onChange={(event) => {
                  setSourceName(event.target.value);
                  clearError("sourceName");
                }}
              />
            )}
          </Field>
          <Field
            id="recipe-source-url"
            label="Source link"
            hint="Optional. Starts with http:// or https://."
            errors={errors.sourceUrl}
          >
            {(control) => (
              <Input
                {...control}
                type="url"
                inputMode="url"
                autoComplete="off"
                value={sourceUrl}
                onChange={(event) => {
                  setSourceUrl(event.target.value);
                  clearError("sourceUrl");
                }}
              />
            )}
          </Field>
        </div>
      </section>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-lg font-semibold">Visibility</legend>
        {errors.status ? <p className="text-destructive text-sm">{errors.status[0]}</p> : null}
        {(
          [
            ["draft", "Draft", "Hidden from other people until you publish it."],
            ["published", "Published", "Visible to everyone, including people who are not signed in."],
          ] as const
        ).map(([value, label, description]) => (
          <label
            key={value}
            className="has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-ring/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:focus-visible]:ring-3"
          >
            <input
              type="radio"
              name="status"
              value={value}
              checked={status === value}
              onChange={() => {
                setStatus(value);
                clearError("status");
              }}
              className="accent-primary mt-0.5 size-4"
            />
            <span className="grid gap-0.5">
              <span className="text-sm font-medium">{label}</span>
              <span className="text-muted-foreground text-sm">{description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t pt-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button asChild variant="ghost">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <p className="text-muted-foreground text-sm">
          {status === "draft"
            ? "This recipe will be saved as a draft."
            : "This recipe will be visible to everyone."}
        </p>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </form>
  );
}
