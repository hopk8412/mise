import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 talks to PostgreSQL through a driver adapter rather than its own
// query engine binary, which is why the connection string is handed to node-postgres.
function createPrismaClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: ReturnType<typeof createPrismaClient> | undefined;
}

// Next's dev server re-evaluates modules on every change. Without a global
// handle each reload would open a new pool and eventually exhaust connections.
export const prisma = globalThis.prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaClient = prisma;
}
