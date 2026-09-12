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
| 1 | Authentication | Not started | — |
| 2 | Recipe CRUD | Not started | — |
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
- **Next 16 renamed `middleware.ts` to `proxy.ts`**, which is what Phase 1 will use.

---

## Phase 1 — Authentication

**Goal:** People can register, sign in, and sign out; routes can require a session.

### Tasks

- [ ] better-auth configured with the Prisma adapter, email/password, cookie sessions
- [ ] `nextCookies()` and `admin()` plugins enabled
- [ ] Auth models added to the Prisma schema; first migration generated
- [ ] `/register`, `/login`, and sign-out
- [ ] `src/proxy.ts` for optimistic redirects
- [ ] Session helper for server components; authenticated route group guarded
- [ ] Seed creates the initial administrator from `ADMIN_EMAIL` / `ADMIN_PASSWORD`

### Verification

- [ ] Register a new account, sign out, sign back in
- [ ] Visiting a protected route while signed out redirects to `/login`
- [ ] Visiting `/login` while signed in redirects away
- [ ] The seeded administrator has the `admin` role
- [ ] Session survives a browser refresh and a container restart
- [ ] Registering with an address already in use fails with a readable message

---

## Phase 2 — Recipe CRUD

**Goal:** Authenticated users can write, edit, publish, and delete recipes.

### Tasks

- [ ] Full Prisma schema: `Recipe`, `Ingredient`, `Step`, `Tag`, `RecipeTag`
- [ ] Zod schemas shared by the client form and the server action
- [ ] Create and edit forms with dynamic ingredient and step rows
- [ ] Tag input, source attribution, draft/publish control
- [ ] `src/lib/storage.ts` — storage interface plus local-disk implementation
- [ ] Image upload with type and size validation; `GET /api/uploads/[...path]`
- [ ] Recipe detail page and `/my-recipes`
- [ ] Authorization: author or admin may edit and delete

### Verification

- [ ] Create a draft; confirm it is invisible to other users and to signed-out visitors
- [ ] Publish it; confirm it becomes visible
- [ ] Edit it, including reordering ingredients and steps
- [ ] Upload an image; confirm it survives `docker compose restart`
- [ ] Delete it; confirm ingredients, steps, and tag links go with it
- [ ] Attempt to edit someone else's recipe; confirm it is refused

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
- [ ] Tag filter, empty states, and no-results states
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
- [ ] Rate limiting on the authentication endpoints
- [ ] Playwright suite: register and sign in, create-publish-edit, search, favorite, rate, admin
- [ ] `compose.prod.yaml` override running the production image
- [ ] `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/OPERATIONS.md`
- [ ] Finish `README.md`

### Verification

- [ ] `npm run test:e2e` passes against the running stack
- [ ] `docker compose -f compose.yaml -f compose.prod.yaml up --build` serves the production image
- [ ] The whole app is navigable by keyboard alone
- [ ] A fresh clone reaches a working app using only the README
