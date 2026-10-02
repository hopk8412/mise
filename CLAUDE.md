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

Each phase lands on `main` as squash-merged pull requests whose titles begin `Phase N:`,
so every resulting commit subject does too. See "Phase workflow" below.

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

## Phase workflow

This is a standing rule: implement every phase with the agent team, not in the lead
session. Asking to "continue the current phase" or "do Phase N" is a request to run
the team.

1. **Plan (lead).** Read the phase in `docs/ROADMAP.md` and break it into tasks on the
   board with `scripts/tasks.mjs`, each tagged `backend` or `ux`, with `--deps` where
   one task needs another's output.
2. **Build (teammates).** Spawn the `backend` and `ux` agents. Each claims tasks from
   the board and works in its own git worktree on a `team/<role>/<task>` branch, never
   in the lead's checkout. Teammates agree API contracts over SendMessage and record
   them with `contract`.
3. **Review (adversary).** Before any pull request is opened, the `adversary` agent
   reviews the branch. A PR may be opened only after an APPROVE verdict on the latest
   commit; BLOCK findings are fixed and re-reviewed.
4. **Merge (lead).** The teammate opens the PR with a title beginning `Phase N:` and
   reports its URL to the lead. The lead squash-merges it — never a merge commit or
   rebase — so `main` gets one `Phase N:` commit per task. The lead does not merge a
   PR without the adversary's APPROVE.
5. **Close out (lead).** When every task is merged, the lead runs the phase's
   verification list against the running stack, ticks it in `docs/ROADMAP.md`, records
   decisions made during the phase, and lands that update as a final `Phase N:` PR.
6. **Update the tracker (lead).** Keep the phase tracker page
   (<https://claude.ai/artifact/1XYMw3Xu4zPiLLSfdNcVJD>) in step with `docs/ROADMAP.md`
   whenever a task, check, or phase status changes. Its data lives in the page's
   database: `phases/p0`–`p7` and `meta/project`. Update those documents with the
   artifact data tool; do not republish the page for data changes.

The lead plans, coordinates, merges, and verifies. It does not write application code
itself.

Practical notes from running it:

- Write the phase's API contract (schema, action and query signatures) before
  spawning anyone, and land the data-layer task first; UI tasks then run in parallel
  against merged code instead of a moving branch.
- Teammates create worktrees beside the repo (`../mise.wt-<name>`) and follow the
  worktree section of `docs/DEVELOPMENT.md` (junction `node_modules`, `next dev
  --webpack`, never `rm -rf` the junction). Their shell does not keep `cd` between
  calls, so every command starts with `cd <worktree> &&`.
- The `adversary` cannot send messages; its final report is its verdict. The lead
  starts each review and relays the result. A second adversary instance can review
  another branch in parallel.
- Open PRs from the exact approved commit — no rebase — and squash-merge with
  `--match-head-commit <full sha>` so nothing unreviewed lands.
- `gh` is at `"/c/Program Files/GitHub CLI/gh.exe"` if it is not on the shell's PATH.

## Agent team task board

When working as an agent teammate, track work in `tasks.json` through
`scripts/tasks.mjs`, not the built-in task list. Never edit `tasks.json` by hand: the
script takes a lock and always uses the main checkout's copy, so it is safe to run from
any worktree. Run it on the host, not in the app container (it needs `git`).

```bash
node scripts/tasks.mjs next --role <ux|backend> --agent <your-name>  # claim the next unblocked task
node scripts/tasks.mjs claim <id> --agent <your-name>                # claim a specific task
node scripts/tasks.mjs list --status pending                          # see open work
node scripts/tasks.mjs add --title <t> --role <role> --deps T1,T2 --agent <your-name>
node scripts/tasks.mjs contract <id> --with <teammate> --text <contract> --agent <your-name>
node scripts/tasks.mjs complete <id> --agent <your-name>
node scripts/tasks.mjs release <id> --agent <your-name>              # hand a task back
```

- Use your teammate name as `--agent`. Exit code 2 means a conflict (already claimed,
  blocked, or not yours); pick another task instead of retrying the same one.
- Agree API contracts directly with the other teammate over SendMessage, then record the
  result with `contract` so whoever picks up dependent tasks can read it with `show`.
- If `scripts/tasks.mjs` is missing in your worktree, run the main checkout's copy:
  `node "$(git rev-parse --path-format=absolute --git-common-dir)/../scripts/tasks.mjs" ...`

## Content rules

- Icons come from Lucide or are written as inline SVG. No generated image assets.
- Write application copy plainly and specifically. Avoid filler and promotional phrasing.
- Do not reference how the code was produced anywhere in the application, the
  documentation, or code comments.
