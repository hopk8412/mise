import { Clock, CookingPot, ExternalLink, Timer, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { cache } from "react";

import { RecipeActions } from "@/components/recipe/recipe-actions";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMinutes, parseHttpUrl } from "@/lib/format";
import { getRecipeForViewer, type RecipeDetail } from "@/lib/recipes";
import { getSession } from "@/lib/session";

/**
 * One lookup per request, shared by the page and its metadata. Both go through the same
 * visibility check, so a draft's title never reaches the metadata of someone who cannot see it.
 */
const loadRecipe = cache(async (slug: string): Promise<RecipeDetail | null> => {
  const session = await getSession();
  return getRecipeForViewer(slug, session?.user ?? null);
});

export async function generateMetadata({ params }: PageProps<"/recipes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await loadRecipe(slug);
  if (!recipe) notFound();

  return {
    title: recipe.title,
    description: recipe.description ?? undefined,
    robots: recipe.status === "draft" ? { index: false, follow: false } : undefined,
  };
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="text-muted-foreground flex items-center gap-2">
        <span aria-hidden="true">{icon}</span>
        {label}
      </dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function Source({ name, url }: { name: string | null; url: string | null }) {
  const link = parseHttpUrl(url);
  if (!link && !name) return null;
  const host = link?.hostname.replace(/^www\./, "");

  return (
    <p className="text-muted-foreground text-sm">
      Source:{" "}
      {link ? (
        <a
          href={link.href}
          target="_blank"
          rel="nofollow ugc noopener noreferrer"
          className="text-foreground inline-flex items-center gap-1 underline underline-offset-4"
        >
          {name ? `${name} (${host})` : host}
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ) : (
        <span className="text-foreground">{name}</span>
      )}
    </p>
  );
}

export default async function RecipePage({ params }: PageProps<"/recipes/[slug]">) {
  const { slug } = await params;
  const recipe = await loadRecipe(slug);
  if (!recipe) notFound();

  const { prepMinutes, cookMinutes, servings } = recipe;
  const totalMinutes =
    prepMinutes != null && cookMinutes != null && prepMinutes > 0 && cookMinutes > 0
      ? prepMinutes + cookMinutes
      : null;
  const hasFacts = servings != null || prepMinutes != null || cookMinutes != null;
  const published = recipe.status === "published";
  const date = published && recipe.publishedAt ? recipe.publishedAt : recipe.updatedAt;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <article className="grid gap-8">
        <header className="grid gap-4">
          {recipe.imageUrl ? (
            // Served by the uploads route; sizing comes from the aspect ratio.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="aspect-video w-full rounded-xl object-cover"
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {!published ? <Badge variant="secondary">Draft</Badge> : null}
            <p className="text-muted-foreground text-sm">
              By {recipe.author.name} &middot; {published ? "Published" : "Updated"}{" "}
              <time dateTime={date.toISOString()}>{formatDate(date)}</time>
            </p>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {recipe.title}
          </h1>

          {recipe.description ? (
            <p className="text-muted-foreground text-lg whitespace-pre-line">{recipe.description}</p>
          ) : null}

          {recipe.canEdit ? (
            <RecipeActions
              recipeId={recipe.id}
              slug={recipe.slug}
              title={recipe.title}
              status={recipe.status}
            />
          ) : null}
        </header>

        {hasFacts ? (
          <dl className="flex flex-wrap gap-x-6 gap-y-2 border-y py-4 text-sm">
            {servings != null ? (
              <Fact icon={<Users className="size-4" />} label="Servings">
                {servings}
              </Fact>
            ) : null}
            {prepMinutes != null ? (
              <Fact icon={<Timer className="size-4" />} label="Prep">
                {formatMinutes(prepMinutes)}
              </Fact>
            ) : null}
            {cookMinutes != null ? (
              <Fact icon={<CookingPot className="size-4" />} label="Cook">
                {formatMinutes(cookMinutes)}
              </Fact>
            ) : null}
            {totalMinutes != null ? (
              <Fact icon={<Clock className="size-4" />} label="Total">
                {formatMinutes(totalMinutes)}
              </Fact>
            ) : null}
          </dl>
        ) : null}

        <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-10">
          <section aria-labelledby="ingredients-heading" className="grid content-start gap-3">
            <h2 id="ingredients-heading" className="text-xl font-semibold tracking-tight">
              Ingredients
            </h2>
            <ul className="grid gap-2">
              {recipe.ingredients.map((ingredient, index) => {
                const amount = [ingredient.quantity, ingredient.unit].filter(Boolean).join(" ");
                return (
                  <li key={index} className="border-b pb-2 last:border-b-0">
                    {amount ? <span className="font-medium">{amount} </span> : null}
                    {ingredient.name}
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="steps-heading" className="grid content-start gap-3">
            <h2 id="steps-heading" className="text-xl font-semibold tracking-tight">
              Steps
            </h2>
            <ol className="grid gap-4">
              {recipe.steps.map((step, index) => (
                <li key={index} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium"
                  >
                    {index + 1}
                  </span>
                  <p className="pt-0.5 whitespace-pre-line">{step.text}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <footer className="grid gap-3 border-t pt-4">
          {recipe.tags.length > 0 ? (
            <ul aria-label="Tags" className="flex flex-wrap gap-2">
              {recipe.tags.map((tag) => (
                <li key={tag}>
                  <Badge variant="outline">{tag}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
          <Source name={recipe.sourceName} url={recipe.sourceUrl} />
        </footer>
      </article>
    </main>
  );
}
