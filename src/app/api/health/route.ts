import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { AI_ENABLED } from "@/lib/ai";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({ status: "healthy", database: "up", aiEnabled: AI_ENABLED, time: new Date().toISOString() });
  } catch {
    return fail("database unavailable", 503, { status: "unhealthy", database: "down" });
  }
}
