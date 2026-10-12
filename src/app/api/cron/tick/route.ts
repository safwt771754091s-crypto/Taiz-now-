import { handleError, ok } from "@/lib/http";
import { runAutopilot, ensureAgents } from "@/lib/agents/runtime";
import { releaseDuePosts } from "@/lib/social/scheduler";

export const dynamic = "force-dynamic";

/**
 * Unattended cron tick for serverless hosts (Vercel Cron). The shell
 * autopilot_loop.sh only exists on the dev box; on Vercel this route is the
 * scheduler. It is guarded by CRON_SECRET so it cannot be triggered by the
 * public. Vercel sends it automatically as `Authorization: Bearer <secret>`.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return token.length > 0 && token === secret;
}

export async function GET(req: Request) {
  try {
    if (!process.env.CRON_SECRET) {
      return ok({ skipped: true, reason: "CRON_SECRET غير مضبوط" });
    }
    if (!authorized(req)) return new Response("Unauthorized", { status: 401 });

    await ensureAgents();
    const released = await releaseDuePosts();
    const results = await runAutopilot();
    const okCount = results.filter((r) => r.ok).length;

    return ok({
      ran: results.length,
      ok: okCount,
      released: { due: released.due, published: released.published, failed: released.failed },
      results,
    });
  } catch (err) {
    return handleError(err);
  }
}
