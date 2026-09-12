import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

/**
 * Container health check. Reports degraded rather than throwing so an orchestrator
 * can distinguish "process is up but the database is unreachable" from a crash.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "up" });
  } catch {
    return NextResponse.json(
      { status: "degraded", database: "down" },
      { status: 503 },
    );
  }
}
