# Development

Day-to-day workflow, plus the parts of this setup that will surprise you if nobody
tells you about them.

## The normal loop

```bash
docker compose up
```

That is the whole thing. The app runs at <http://localhost:3000> with hot reload;
edit a file and the browser updates in a few seconds.

Useful variations:

```bash
docker compose up -d          # run in the background
docker compose logs -f app    # follow the app logs
docker compose restart app    # restart just the app
docker compose down           # stop everything, keep the data
docker compose down -v        # stop everything and delete the database and uploads
docker compose build app      # rebuild the image after changing the Dockerfile
```

To run a command inside the container:

```bash
docker compose exec app npm run typecheck
docker compose exec app sh          # a shell in the container
```

## Adding or updating a dependency

**Install dependencies through the container, not on your host machine.**

```bash
docker compose exec app npm install some-package
```

`npm install` run on Windows writes a `package-lock.json` that is missing some
platform-specific transitive dependencies — `@img/sharp-wasm32` needs `@emnapi/core`
and `@emnapi/runtime`, and a Windows resolve leaves them out. The lockfile is then
internally inconsistent and `npm ci` fails during the image build with
`npm ci can only install packages when your package.json and package-lock.json are in sync`.

If that happens, regenerate the lockfile in a Linux container:

```bash
docker run --rm -v "$PWD:/work" -w /work node:24-alpine npm install --package-lock-only
```

The container notices a changed `package-lock.json` on start-up and reinstalls into
its `node_modules` volume automatically, so you do not need to rebuild the image
after adding a package — just restart the container.

## Database

Migrations are applied automatically every time the app container starts. To create
one after changing `prisma/schema.prisma`:

```bash
docker compose exec app npx prisma migrate dev --name describe_your_change
```

Other database commands:

```bash
docker compose exec app npx prisma migrate status   # what is applied, what is pending
docker compose exec app npm run db:seed             # re-run the seed (idempotent)
docker compose exec app npx prisma migrate reset    # wipe and rebuild from migrations
```

`prisma migrate reset` destroys all data in the development database.

### Connecting with a database client

PostgreSQL is published on the host at port **5435**. Two ports were already
spoken for: 5432 by a local PostgreSQL install, and 5433/5434 by the `recipe-roost`
stack in the neighbouring directory. Change it with `POSTGRES_HOST_PORT` in `.env`.

```
host     localhost
port     5435
database mise
user     mise
password mise
```

`recipe-roost` also publishes 3000 when its `full` profile is running. If you need
both stacks up at once, set `APP_PORT` in `.env` to something else.

Prisma Studio, run from the host, uses the `DATABASE_URL` in your `.env`, which
points at `localhost:5435`:

```bash
npm run db:studio
```

## Things that are not obvious

### The dev server runs webpack, not Turbopack

Next 16 defaults to Turbopack, and `npm run dev` uses it. The container runs
`npm run dev:docker`, which is `next dev --webpack`, because **Turbopack's file
watcher does not see changes to bind-mounted files on Docker Desktop for Windows**.
Setting `watchOptions.pollIntervalMs` in `next.config.ts` does not help; the watcher
simply never fires. Webpack with `WATCHPACK_POLLING=true` works and picks up edits in
roughly five seconds.

`next build` still uses the Turbopack default. If you hit a bundler-specific problem
that only appears in a production build, that difference is the first thing to check.

### `.env` does not configure the container

`compose.yaml` sets the app's environment explicitly, and those values win over the
bind-mounted `.env` file. This is deliberate and it matters for one variable in
particular: `DATABASE_URL` in `.env` points at `localhost:5435` for host-side tooling,
while the container needs `db:5432`. Compose supplies the latter.

The `.env` file *is* read by Compose for `${...}` substitution, so changing
`POSTGRES_HOST_PORT` or `APP_PORT` there does take effect. To change an app setting,
change it in `.env` and confirm `compose.yaml` passes it through.

### `node_modules` and `.next` are volumes, not your local copies

The source tree is bind-mounted, but `node_modules` and `.next` are Docker-managed
volumes layered on top. Your host copies are built for Windows and would break the
Linux container if they leaked in. This means:

- `node_modules` on your host is only there for editor autocomplete.
- Deleting `node_modules` on your host does not affect the container.
- To force a clean install in the container: `docker compose down -v` then `up`.

### The Prisma client is generated into the source tree

`prisma generate` writes to `src/generated/prisma`, which is gitignored and
regenerated on every container start. It is plain TypeScript with no native binaries,
so the same files work on both the Windows host and inside the Linux container.

Import it through `@/generated/prisma/client`, or better, use the shared instance
from `@/lib/db` so the connection pool is reused.

### Prisma 7 needs a driver adapter

Prisma 7 dropped the bundled query engine in favour of driver adapters. `src/lib/db.ts`
wires `PrismaClient` to `@prisma/adapter-pg`. A `new PrismaClient()` with no adapter
will not connect.

### Next 16 renamed `middleware.ts` to `proxy.ts`

The file convention is `src/proxy.ts` and the export is `proxy`. `middleware.ts` still
works but is deprecated. Per the Next docs, the proxy runs separately from render code,
so it is used only for cheap optimistic redirects — real authorization checks belong in
layouts, pages, and server actions.

## Before you commit

```bash
docker compose exec app npm run typecheck
docker compose exec app npm run lint
```
