import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";
import { ensureAgents } from "@/lib/agents/runtime";
import { AGENT_KIND_LABELS } from "@/lib/agents/catalog";

/** List the AI agents with their recent activity. Requires agents:manage. */
export async function GET() {
  try {
    await requirePermission("agents:manage");
    await ensureAgents();
    const agents = await prisma.agent.findMany({
      orderBy: { createdAt: "asc" },
      include: { runs: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    const recentRuns = await prisma.agentRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { agent: { select: { name: true, slug: true } } },
    });
    return ok({
      agents: agents.map((a) => ({
        ...a,
        kindLabel: AGENT_KIND_LABELS[a.kind],
      })),
      recentRuns,
    });
  } catch (err) {
    return handleError(err);
  }
}
