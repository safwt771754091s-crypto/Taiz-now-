import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { clientIp, fail, handleError, ok, writeAudit } from "@/lib/http";
import { connectProvider } from "@/lib/social/connect";
import { recordSecurityEvent } from "@/lib/security/events";

const schema = z.object({
  action: z.enum(["connect", "disconnect"]).default("connect"),
  provider: z.string().min(2).max(30),
  handle: z.string().max(80).optional(),
  accountName: z.string().max(120).optional(),
  credentials: z.record(z.string(), z.unknown()).optional(),
});

/** Connect (or disconnect) a social platform account. */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("social:manage");
    const data = schema.parse(await req.json());
    if (data.action === "disconnect") {
      const { prisma } = await import("@/lib/prisma");
      await prisma.platformIdentity.update({
        where: { provider: data.provider },
        data: { connected: false },
      });
      const conn = await prisma.socialConnection.update({
        where: { provider: data.provider },
        data: { enabled: false },
      });
      await writeAudit({ actorId: user?.id, action: "social.disconnect", entityType: "SocialConnection", entityId: conn.id, ip: clientIp(req) });
      await recordSecurityEvent({
        kind: "CONNECTION_CHANGE",
        severity: "HIGH",
        title: `فصل قناة التواصل ${data.provider}`,
        detail: { provider: data.provider, action: "disconnect" },
        actorId: user?.id,
      });
      return ok(conn);
    }

    try {
      const conn = await connectProvider(data);
      await writeAudit({
        actorId: user?.id,
        action: "social.connect",
        entityType: "SocialConnection",
        entityId: conn.id,
        detail: { provider: conn.provider, mode: conn.mode },
        ip: clientIp(req),
      });
      await recordSecurityEvent({
        kind: "CONNECTION_CHANGE",
        severity: conn.enabled ? "MEDIUM" : "HIGH",
        title: `${conn.enabled ? "تمكين" : "تعطيل"} قناة ${conn.provider}`,
        detail: { provider: conn.provider, enabled: conn.enabled, mode: conn.mode },
        actorId: user?.id,
      });
      return ok(conn);
    } catch (e) {
      return fail((e as Error).message, 400);
    }
  } catch (err) {
    return handleError(err);
  }
}
