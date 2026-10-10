import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { clientIp, handleError, ok, writeAudit } from "@/lib/http";
import { runAgent } from "@/lib/agents/runtime";

const actionSchema = z.object({
  action: z.enum(["run", "enable", "pause", "disable"]),
});

/**
 * Control a single agent: run it now, or toggle its status. Running an agent
 * only operates on stored data and never publishes unverified content.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("agents:manage");
    const { id } = await ctx.params;
    const { action } = actionSchema.parse(await req.json());

    if (action === "run") {
      const result = await runAgent(id);
      if (!result) return ok(null, 404);
      await writeAudit({
        actorId: user?.id,
        action: "agent.run",
        entityType: "Agent",
        entityId: id,
        detail: { summary: result.summary },
        ip: clientIp(req),
      });
      return ok(result);
    }

    const status = action === "enable" ? "ENABLED" : action === "pause" ? "PAUSED" : "DISABLED";
    const agent = await prisma.agent.update({ where: { id }, data: { status } });
    await writeAudit({
      actorId: user?.id,
      action: `agent.${action}`,
      entityType: "Agent",
      entityId: id,
      ip: clientIp(req),
    });
    return ok(agent);
  } catch (err) {
    return handleError(err);
  }
}
