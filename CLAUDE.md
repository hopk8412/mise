@AGENTS.md

# mise

A recipe web application: browse, search, write, favorite, and grade recipes, with an
administration area. Scope is deliberately narrow — recipes and the machinery around
them. There is no blog, no about page, and no marketing content.

## Read these first

1. **`docs/ROADMAP.md`** — what is done, what is next, and decisions made along the
   way. Every phase is a checklist. Update it as work completes; it is how a later
   session knows where things stand.
2. **`docs/DEVELOPMENT.md`** — the workflow and the non-obvious parts of the setup.

Phases land as commits whose subject begins `Phase N:`.

## Commands

Everything runs in Docker. `docker compose up` is the whole dev loop.

```bash
docker compose up                                    # start everything
docker compose exec app npm run typecheck            # type check
docker compose exec app npm run lint                 # lint
docker compose exec app npm install <pkg>            # add a dependency (not on the host)
docker compose exec app npx prisma migrate dev --name <name>   # create a migration
```

## Versions matter here

This project uses releases that postdate most model training data. Check before
assuming an API:

- **Next.js 16** — `middleware.ts` is renamed to `proxy.ts`; Turbopack is the default
  bundler. Bundled documentation lives in `node_modules/next/dist/docs/`.
- **Prisma 7** — requires a driver adapter (`@prisma/adapter-pg`); the client generates
  to `src/generated/prisma`; configuration is `prisma.config.ts`. Reference docs ship in
  `.agents/skills/prisma-cli/` and `.agents/skills/prisma-client-api/`.
- **better-auth 1.7** — the Prisma adapter is the separate `@better-auth/prisma-adapter`
  package.
- **Tailwind v4** and **shadcn/ui** with the Radix base and Lucide icons.

## Conventions

- TypeScript strict. Prefer server components and server actions; reach for
  `"use client"` only where interactivity requires it.
- Validation schemas are shared between client and server — define them once in
  `src/lib/validation/` and use them in both places.
- Authorization is checked server-side in the action or page that performs the work,
  never only in a layout or in `proxy.ts`.
- Raw SQL lives in `src/lib/search.ts` and nowhere else.
- Use the shared Prisma instance from `@/lib/db`.

## Content rules

- Icons come from Lucide or are written as inline SVG. No generated image assets.
- Write application copy plainly and specifically. Avoid filler and promotional phrasing.
- Do not reference how the code was produced anywhere in the application, the
  documentation, or code comments.
