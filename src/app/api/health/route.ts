import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/http";
import { AI_ENABLED, activeProvider, activeModel } from "@/lib/llm";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const provider = activeProvider();
    return ok({
      status: "healthy",
      database: "up",
      aiEnabled: AI_ENABLED,
      aiProvider: provider,
      aiModel: provider ? activeModel() : null,
      time: new Date().toISOString(),
    });
  } catch {
    return fail("database unavailable", 503, { status: "unhealthy", database: "down" });
  }
}
