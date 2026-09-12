#!/bin/sh
# Brings the container up in a usable state before handing off to the app:
# wait for Postgres, reconcile dependencies, apply migrations, seed if asked.
set -e

log() { echo "[mise] $*"; }

DB_HOST="${POSTGRES_HOST:-db}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_USER="${POSTGRES_USER:-mise}"

log "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}"
attempts=0
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -q; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 60 ]; then
    log "PostgreSQL did not become ready within 60s. Aborting."
    exit 1
  fi
  sleep 1
done
log "PostgreSQL is ready"

if [ "$NODE_ENV" != "production" ]; then
  # The source tree is bind-mounted while node_modules is a named volume, so the
  # two can fall out of sync whenever package-lock.json changes on the host.
  lockhash_file="node_modules/.lockhash"
  current_hash="$(md5sum package-lock.json | awk '{print $1}')"
  if [ ! -f "$lockhash_file" ] || [ "$(cat "$lockhash_file")" != "$current_hash" ]; then
    log "Lockfile changed since node_modules was built. Installing dependencies."
    npm ci
    echo "$current_hash" > "$lockhash_file"
  fi

  log "Generating Prisma client"
  npx prisma generate
fi

if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  log "Applying database migrations"
  npx prisma migrate deploy
else
  log "No migrations to apply"
fi

if [ "${SEED_ON_START:-true}" = "true" ] && [ -f prisma/seed.ts ]; then
  log "Seeding database"
  npx prisma db seed
fi

log "Starting: $*"
exec "$@"
