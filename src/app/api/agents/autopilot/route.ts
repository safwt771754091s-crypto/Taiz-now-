import { requirePermission } from "@/lib/auth";
import { clientIp, handleError, ok, writeAudit } from "@/lib/http";
import { runAutopilot, ensureAgents } from "@/lib/agents/runtime";

/** Run the full agent autopilot tick once (all ENABLED agents, in order). */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("agents:manage");
    await ensureAgents();
    const results = await runAutopilot();
    const okCount = results.filter((r) => r.ok).length;
    await writeAudit({
      actorId: user?.id,
      action: "agents.autopilot",
      detail: { agents: results.length, ok: okCount },
      ip: clientIp(req),
    });
    return ok({ results, ran: results.length, ok: okCount });
  } catch (err) {
    return handleError(err);
  }
}
