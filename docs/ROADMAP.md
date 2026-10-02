# Roadmap

How the work on mise is divided, and where it currently stands. **Read this first
when picking the project back up** — it is the record of what is done and what
comes next.

## Conventions

- Phases are ordered by dependency. Each builds on the last and leaves the app in
  a working, runnable state.
- Every phase lands as one or more commits whose subject begins `Phase N:`, so the
  history for a phase is `git log --grep "^Phase 3:"`.
- When a phase finishes, tick its task and verification boxes and update its row
  in the status table.

## Status

| Phase | Title | Status | Completed |
|---|---|---|---|
| 0 | Scaffold and Docker foundation | Complete | 2026-09-12 |
| 1 | Authentication | Complete | 2026-10-01 |
| 2 | Recipe CRUD | Complete | 2026-10-02 |
| 3 | Browse and search | Not started | — |
| 4 | Favorites | Not started | — |
| 5 | Ratings | Not started | — |
| 6 | Admin area | Not started | — |
| 7 | Polish, tests, and documentation | Not started | — |

---

## Phase 0 — Scaffold and Docker foundation

**Goal:** A fresh clone reaches a running application with one command.

### Tasks

- [x] Scaffold Next.js 16 (App Router, TypeScript strict, `src/`, Tailwind v4)
- [x] Initialize shadcn/ui (Radix base, Lucide icons) and add the base component set
- [x] Add Prisma 7 with the `@prisma/adapter-pg` driver adapter
- [x] Prisma client singleton at `src/lib/db.ts`
- [x] Multi-stage `Dockerfile` (`deps` / `dev` / `build` / `prod`)
- [x] `docker/entrypoint.sh` — wait for Postgres, reconcile deps, migrate, seed
- [x] `compose.yaml` with `db` + `app`, named volumes, hot reload
- [x] `.env.example` with a working default for every variable
- [x] `GET /api/health` process and database check
- [x] `docs/ROADMAP.md`, `docs/DEVELOPMENT.md`, `README.md`, `CLAUDE.md`

### Verification

- [x] `docker compose up` on a cold clone serves the app on <http://localhost:3000>
- [x] `GET /api/health` returns `200 {"status":"ok","database":"up"}`
- [x] Editing a source file reloads the browser without an image rebuild
- [x] `npm run typecheck` is clean

### Decisions made during this phase

- **The containerized dev server runs webpack, not Turbopack.** Turbopack's file
  watcher does not observe changes to bind-mounted files on Docker Desktop for
  Windows, with or without `watchOptions.pollIntervalMs`. Webpack with
  `WATCHPACK_POLLING=true` does, and picks up edits in about five seconds. The
  `dev` script still uses the Turbopack default for anyone running on the host;
  `dev:docker` is the webpack one compose invokes.
- **`package-lock.json` must stay Linux-consistent.** `npm install` on Windows
  omits some platform-specific transitive dependencies, which makes `npm ci`
  fail inside the image. Install dependencies through the container. See
  `docs/DEVELOPMENT.md`.
- **Next 16 renamed `middleware.ts` to `proxy.ts`**; Phase 1 uses `src/proxy.ts`.
- **PostgreSQL publishes on host port 5435.** 5432 belongs to a local PostgreSQL
  install and 5433/5434 to the `recipe-roost` stack in the neighbouring directory.
  That stack also publishes 3000 under its `full` profile, so running both at once
  needs `APP_PORT` set here as well.

---

## Phase 1 — Authentication

**Goal:** People can register, sign in, and sign out; routes can require a session.

### Tasks

- [x] better-auth configured with the Prisma adapter, email/password, cookie sessions
- [x] `nextCookies()` and `admin()` plugins enabled
- [x] `src/lib/auth.ts`, `src/lib/auth-client.ts`, and the `/api/auth/[...all]` handler
- [x] Auth models added to the Prisma schema; first migration generated
- [x] `prisma/seed.ts` — idempotent, upserts the administrator from `ADMIN_EMAIL` /
      `ADMIN_PASSWORD` / `ADMIN_NAME`
- [x] `/register`, `/login`, and sign-out
- [x] `src/proxy.ts` for optimistic redirects
- [x] Session helper for server components; authenticated route group guarded

### Verification

- [x] Register a new account, sign out, sign back in
- [x] Visiting a protected route while signed out redirects to `/login`
- [x] Visiting `/login` while signed in redirects away
- [x] The seeded administrator has the `admin` role
- [x] Session survives a browser refresh and a container restart
- [x] Registering with an address already in use fails with a readable message

### Decisions made during this phase

- **Auth forms submit to server actions, not the client SDK.** `src/lib/actions/auth.ts`
  calls `auth.api.signInEmail` / `signUpEmail` / `signOut` with the request headers;
  `nextCookies()` writes the session cookie from inside the action. The forms validate
  with the same Zod schemas (`src/lib/validation/auth.ts`) before submitting, and the
  action validates again. `src/lib/auth-client.ts` stays available for client-side
  session reads but nothing uses it yet.
- **Where the session is checked.** `src/proxy.ts` only looks for the session cookie
  (`getSessionCookie`) and redirects to `/login?next=…` when it is missing. It does not
  validate the cookie, so it is never what grants access. `requireSession()` in
  `src/lib/session.ts` does the real lookup and must be called in every page and
  server action that needs a user — the `(app)` layout calls it too, but layouts do not
  guard actions. `getSession()` is wrapped in React `cache`, so repeated calls in one
  render cost one query.
- **Adding a protected route means adding it to the proxy matcher** in `src/proxy.ts`
  (currently only `/my-recipes`). Forgetting it is not a security hole — the page's own
  `requireSession` still redirects — but the `?next=` return path is lost.
- **`/login` and `/register` redirect away based on a validated session, in the page,
  not in the proxy.** A cookie-only check there would trap someone holding an expired
  cookie: the proxy would bounce them off `/login` while every protected page bounced
  them back.
- **`?next=` is restricted to same-site paths** by `safeNextPath` in
  `src/lib/safe-redirect.ts` (rejects `//host`, `/\host`, absolute URLs, and loops back
  to the auth pages). It is applied when the page renders and again in the action.
- **Emails are lowercased and trimmed** by the shared schema before they reach
  better-auth, so `Cook@Example.com` and `cook@example.com` are the same account.
- **The seed re-asserts the admin role on every start.** If the `ADMIN_EMAIL` account
  exists without the `admin` role, the seed grants it again. It never changes that
  account's password. Phase 6's "revoke admin" guardrails should account for this —
  revoking the seeded administrator lasts only until the next container start while
  `SEED_ON_START=true`.
- **Prisma models are `User`/`Session`/`Account`/`Verification` mapped to the lowercase
  table names** better-auth expects. If the plugin set changes, compare the schema
  against `getAuthTables` from `better-auth/db` (pass the same options as
  `src/lib/auth.ts`) rather than using `@better-auth/cli`, whose latest release trails
  the installed better-auth by three minor versions.
- **`/my-recipes` exists as a placeholder** so there was a real protected route to
  verify against. Phase 2 replaces its body.
- **Fixed the sans-serif font.** `globals.css` mapped `--font-sans` to itself, so the
  app rendered in the browser's serif fallback; it now points at Geist.

---

## Phase 2 — Recipe CRUD

**Goal:** Authenticated users can write, edit, publish, and delete recipes.

### Tasks

- [x] Full Prisma schema: `Recipe`, `Ingredient`, `Step`, `Tag`, `RecipeTag`
- [x] Zod schemas shared by the client form and the server action
- [x] Create and edit forms with dynamic ingredient and step rows
- [x] Tag input, source attribution, draft/publish control
- [x] `src/lib/storage.ts` — storage interface plus local-disk implementation
- [x] Image upload with type and size validation; `GET /api/uploads/[...path]`
- [x] Recipe detail page and `/my-recipes`
- [x] Authorization: author or admin may edit and delete

### Verification

- [x] Create a draft; confirm it is invisible to other users and to signed-out visitors
- [x] Publish it; confirm it becomes visible
- [x] Edit it, including reordering ingredients and steps
- [x] Upload an image; confirm it survives `docker compose restart`
- [x] Delete it; confirm ingredients, steps, and tag links go with it
- [x] Attempt to edit someone else's recipe; confirm it is refused

### Decisions made during this phase

- **The form posts JSON, not indexed field names.** `FormData` carries `data`
  (the `RecipeInput` as JSON), an optional `image` file, and `removeImage`.
  `parseRecipeForm` in `src/lib/recipe-form.ts` checks the multipart shape (at
  most 8 entries, only `image` may be a file), caps `data` at 1.5M characters,
  and rejects over-long arrays **before** Zod runs. Zod 4 parses every array
  element before `.max()` applies, so without the pre-check a 1 MB request
  produced hundreds of thousands of issues and a 20 MB response.
- **Refusals.** A recipe the viewer cannot see is `notFound()` everywhere —
  pages, metadata and actions — so a hidden draft is indistinguishable from a
  missing slug. A recipe the viewer can see but not edit gets a form error (update)
  or a thrown error (delete, publish). `forbidden()` is not used: it needs
  `experimental.authInterrupts`.
- **Visibility is applied in the query** (`visibleTo` / `editableBy` in
  `src/lib/recipes.ts`), so a hidden draft costs the same as a missing slug, and
  `canViewRecipe` / `canEditRecipe` still run on the result.
  `listOwnRecipes(viewerId)` returns drafts and must only be given the session
  user's id.
- **Slugs are permanent**: the title plus a six-character random suffix, set at
  creation and never changed, so links survive a title edit and slugs cannot be
  guessed.
- **Tags are global**, stored lowercase, returned alphabetically, and never cleaned
  up when unused. A draft's tags exist as rows, so Phase 3 must list only tags
  attached to a published recipe.
- **Every upload is re-encoded with `sharp`** after a magic-byte check (JPEG, PNG,
  WebP only). Re-encoding strips EXIF, GPS, XMP and ICC metadata and any trailing
  bytes. Limits: 5 MB, 8000 px a side, 25 megapixels. Re-encoding runs one at a
  time behind a process-wide gate with up to 10 waiting; beyond that the upload
  fails with "Image processing is busy". Peak memory for the worst case is about
  600 MB and does not grow with concurrency. `sharp` is a direct dependency.
- **Images are served from `GET /api/uploads/[...path]`** with `nosniff`, a
  `default-src 'none'` CSP and immutable caching. Only `recipes/<uuid>.(jpg|png|webp)`
  keys are served. A draft's image is readable by anyone who has its URL; the key is
  a random UUID and is never listed.
- **The server-action body limit is 7 MB** (`experimental.serverActions.bodySizeLimit`).
- **`server-only`** guards `src/lib/recipes.ts`, `storage.ts` and `images.ts`, but
  not `db.ts`: `prisma/seed.ts` imports it under plain `tsx`, where `server-only`
  does not resolve.

### Follow-ups recorded for later phases

- Phase 3: list only tags on published recipes.
- Phase 6: deleting a user cascades their recipes in the database but leaves their
  image files on disk; delete the files too.
- Phase 7: rate limits and per-user upload quotas on recipe creation and uploads, a
  `mem_limit` on the app service, a `sharp` processing timeout, an `error.tsx`
  boundary for failed publish or delete, and `npm audit` in CI.

---

## Phase 3 — Browse and search

**Goal:** Recipes can be found by keyword and by tag.

### Tasks

- [ ] `/recipes` listing with pagination
- [ ] `search_vector` column, GIN index, and refresh trigger in a hand-written migration
- [ ] Weighted full-text search over title, description, ingredients, and tags
- [ ] Prefix matching so partial words match
- [ ] `src/lib/search.ts` — all raw SQL isolated here
- [ ] Debounced search input with state reflected in the URL
- [ ] Tag filter, empty states, and no-results states (list only tags attached to a published recipe)
- [ ] Home page shows recent published recipes

### Verification

- [ ] A word appearing only in an ingredient finds the recipe
- [ ] A title match ranks above an ingredient-only match
- [ ] Partial words match (searching `chick` finds `chicken`)
- [ ] Drafts never appear in results
- [ ] A search URL can be shared and restores the same results
- [ ] Editing a recipe updates its search entry

---

## Phase 4 — Favorites

**Goal:** Signed-in users can save recipes and find them again.

### Tasks

- [ ] `Favorite` model, composite primary key on `(userId, recipeId)`
- [ ] Toggle control on recipe cards and the detail page, with optimistic update
- [ ] `/favorites` page
- [ ] Signed-out visitors are prompted to sign in rather than failing silently

### Verification

- [ ] Favorite from a card and from the detail page
- [ ] Confirm it appears on `/favorites` and persists across sessions
- [ ] Unfavorite; confirm it disappears
- [ ] Deleting a recipe removes it from everyone's favorites

---

## Phase 5 — Ratings

**Goal:** Any signed-in user can grade a recipe S through F.

### Tasks

- [ ] `Rating` model with an `S|A|B|C|D|F` enum, composite primary key
- [ ] `src/lib/ratings.ts` — grade and score mapping, aggregation
- [ ] Grade selector on the detail page showing the viewer's own grade
- [ ] Grades can be changed and removed
- [ ] `ratingSum` and `ratingCount` maintained on `Recipe` in the same transaction
- [ ] Aggregate display (`A · 4.2 avg · 18 ratings`) on cards and detail
- [ ] "Not yet rated" zero state

### Verification

- [ ] Rate as two users; confirm the average and count are right
- [ ] Change a grade; confirm the aggregate moves and the count does not
- [ ] Remove a grade; confirm the count drops
- [ ] Signed-out visitors see the aggregate but cannot rate
- [ ] Deleting a recipe leaves no orphaned ratings
- [ ] Aggregates stay correct after a container restart

---

## Phase 6 — Admin area

**Goal:** Administrators can manage users and all recipe data.

### Tasks

- [ ] `/admin` route group guarded by role in its layout
- [ ] `/admin/users` — paginated, searchable list with grant and revoke admin
- [ ] Guardrails: cannot revoke your own admin, cannot remove the last admin
- [ ] `/admin/recipes` — every recipe including drafts
- [ ] Admin edit, unpublish, single delete, and bulk delete behind confirmation
- [ ] Admin actions re-check authorization server-side, not only in the layout
- [ ] Deleting a user also deletes their recipes' image files

### Verification

- [ ] A non-admin visiting `/admin/users` is redirected
- [ ] Granting admin to another account gives them access
- [ ] Revoking it removes access
- [ ] Revoking your own admin is refused
- [ ] Removing the last admin is refused
- [ ] Bulk delete removes ingredients, steps, favorites, and ratings with the recipe
- [ ] Invoking an admin action directly without the role is refused

---

## Phase 7 — Polish, tests, and documentation

**Goal:** The app is pleasant to use, covered by tests, and documented for whoever maintains it.

### Tasks

- [ ] Accessibility: keyboard navigation, focus states, labels, contrast
- [ ] Responsive layouts down to a phone width
- [ ] Loading and error boundaries; a real 404
- [ ] Rate limiting on the authentication endpoints, recipe creation, and image uploads
- [ ] Per-user upload quota, a `mem_limit` on the app service, and a timeout on image processing
- [ ] `npm audit` in CI (`sharp` and its codecs handle untrusted input)
- [ ] Playwright suite: register and sign in, create-publish-edit, search, favorite, rate, admin
- [ ] `compose.prod.yaml` override running the production image
- [ ] `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/OPERATIONS.md`
- [ ] Finish `README.md`

### Verification

- [ ] `npm run test:e2e` passes against the running stack
- [ ] `docker compose -f compose.yaml -f compose.prod.yaml up --build` serves the production image
- [ ] The whole app is navigable by keyboard alone
- [ ] A fresh clone reaches a working app using only the README
