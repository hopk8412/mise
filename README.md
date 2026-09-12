# mise

A web application for keeping, finding, and sharing food recipes.

Anyone can browse and search published recipes. With an account you can write your
own, save the ones you like, and grade recipes on an S-to-F scale. Administrators
get a management area for users and recipe data.

The project is built in phases. **[docs/ROADMAP.md](docs/ROADMAP.md) is the record
of what is finished and what is next** — start there.

## Running it

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/). Nothing
else: no Node install, no database setup.

```bash
docker compose up
```

Then open <http://localhost:3000>.

The first start takes a few minutes while the image builds. After that it is quick.
Compose brings up PostgreSQL, waits for it to accept connections, applies database
migrations, seeds sample data, and starts the app with hot reload. Edits to files on
your machine are picked up without rebuilding anything.

To stop it, press `Ctrl+C`, or run `docker compose down`. Your data lives in a Docker
volume and survives both. `docker compose down -v` deletes it.

### Changing the defaults

Every setting has a working default, so no configuration file is required. To change
one, copy the example and edit it:

```bash
cp .env.example .env
```

The most likely thing you will want to change is `POSTGRES_HOST_PORT`, if something
on your machine already uses port 5433.

## Layout

| Path | What is in it |
|---|---|
| `src/app/` | Routes, pages, and API handlers (App Router) |
| `src/components/` | React components; `ui/` holds the shadcn/ui primitives |
| `src/lib/` | Database client, auth, storage, search, and validation |
| `prisma/` | Schema, migrations, and the seed script |
| `docker/` | Container entrypoint |
| `docs/` | Roadmap and developer documentation |

## Built with

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) with React 19 |
| Language | TypeScript, strict |
| Database | PostgreSQL 17 |
| Data access | Prisma 7 via the `@prisma/adapter-pg` driver adapter |
| Authentication | better-auth — email and password, cookie sessions |
| Styling | Tailwind CSS v4 with shadcn/ui components |
| Icons | Lucide |
| Tests | Playwright |

## Working on it

See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** for the day-to-day workflow,
database migrations, and a list of the things in this setup that are not obvious.
