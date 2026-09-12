# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# base - shared by every stage.
# postgresql-client supplies pg_isready, which the entrypoint uses to wait for
# the database before touching it.
# ---------------------------------------------------------------------------
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat postgresql-client
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------------------
# deps - install node_modules once so the other stages can copy them.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci
# Stamp the lockfile hash into node_modules. In development node_modules lives in
# a named volume that outlives image rebuilds, so the entrypoint compares this
# stamp against the mounted lockfile and reinstalls when they have diverged.
RUN md5sum package-lock.json | awk '{print $1}' > /app/node_modules/.lockhash

# ---------------------------------------------------------------------------
# dev - compose bind-mounts the source over /app, so this stage exists to
# supply node_modules and the toolchain.
# ---------------------------------------------------------------------------
FROM base AS dev
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENTRYPOINT ["/bin/sh", "/app/docker/entrypoint.sh"]
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
# build - compile the production bundle.
# ---------------------------------------------------------------------------
FROM base AS build
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---------------------------------------------------------------------------
# prod - runtime image.
#
# node_modules is carried over in full rather than pruned to production-only.
# The entrypoint runs `prisma migrate deploy` and `prisma db seed` at start-up,
# and both the Prisma CLI and tsx are development dependencies. Splitting
# migrations into a separate init container would allow a smaller image; that
# trade is documented in docs/OPERATIONS.md.
# ---------------------------------------------------------------------------
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/docker ./docker
COPY --from=build /app/package.json /app/package-lock.json /app/prisma.config.ts /app/next.config.ts ./
RUN mkdir -p /app/var/uploads && chown -R node:node /app/var /app/.next
USER node
EXPOSE 3000
ENTRYPOINT ["/bin/sh", "/app/docker/entrypoint.sh"]
CMD ["npm", "run", "start"]
