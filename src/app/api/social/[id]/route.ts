import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { clientIp, handleError, ok, writeAudit } from "@/lib/http";
import { recordSecurityEvent } from "@/lib/security/events";

const schema = z.object({
  enabled: z.boolean().optional(),
  handle: z.string().max(80).optional(),
  accountName: z.string().max(120).optional(),
});

/** Enable/disable or rename a single social connection. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("social:manage");
    const { id } = await ctx.params;
    const data = schema.parse(await req.json());
    const conn = await prisma.socialConnection.update({ where: { id }, data });
    await writeAudit({
      actorId: user?.id,
      action: "social.update",
      entityType: "SocialConnection",
      entityId: id,
      detail: data,
      ip: clientIp(req),
    });
    if (typeof data.enabled === "boolean" || data.handle) {
      await recordSecurityEvent({
        kind: "CONNECTION_CHANGE",
        severity: "MEDIUM",
        title: `تغيير إعدادات قناة ${conn.provider}`,
        detail: { provider: conn.provider, ...data },
        actorId: user?.id,
      });
    }
    return ok(conn);
  } catch (err) {
    return handleError(err);
  }
}
