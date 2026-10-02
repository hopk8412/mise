type Viewer = { id: string; role?: string | null } | null | undefined;

/** True for users holding the administrator role. */
export function isAdmin(user: { role?: string | null } | null | undefined): boolean {
  if (!user?.role) return false;
  // better-auth stores several roles as a comma-separated string.
  return user.role.split(",").some((role) => role.trim() === "admin");
}

/** Authors edit their own recipes; administrators edit any. */
export function canEditRecipe(user: Viewer, recipe: { authorId: string }): boolean {
  if (!user) return false;
  return user.id === recipe.authorId || isAdmin(user);
}

/** Published recipes are public; drafts are visible only to whoever can edit them. */
export function canViewRecipe(
  user: Viewer,
  recipe: { authorId: string; status: "DRAFT" | "PUBLISHED" },
): boolean {
  return recipe.status === "PUBLISHED" || canEditRecipe(user, recipe);
}
