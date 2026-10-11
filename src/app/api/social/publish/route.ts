import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { clientIp, fail, handleError, ok, writeAudit } from "@/lib/http";
import { publishContent, publishText } from "@/lib/social/connect";
import { scheduleContent } from "@/lib/social/scheduler";

const schema = z.object({
  action: z.enum(["publish-content", "publish-text", "schedule-content"]).default("publish-content"),
  contentItemId: z.string().optional(),
  title: z.string().max(300).optional(),
  body: z.string().max(20000).optional(),
  scheduledAt: z.string().datetime().optional(),
});

/**
 * Publish a verified item (or a free-form statement) to every enabled channel.
 * Content must be PUBLISHED before the platform distributes it. The
 * schedule-content action queues the item instead of sending it immediately.
 */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("social:manage");
    const data = schema.parse(await req.json());

    if (data.action === "publish-text") {
      if (!data.title || !data.body) return fail("العنوان والنص مطلوبان", 422);
      const outcomes = await publishText({ title: data.title, body: data.body });
      await writeAudit({
        actorId: user?.id,
        action: "social.publish_text",
        detail: { channels: outcomes.length },
        ip: clientIp(req),
      });
      return ok({ outcomes });
    }

    if (!data.contentItemId) return fail("معرّف المحتوى مطلوب", 422);
    const item = await prisma.contentItem.findUnique({ where: { id: data.contentItemId } });
    if (!item) return fail("المحتوى غير موجود", 404);
    if (item.status !== "PUBLISHED") return fail("لا يُنشر إلا محتوى موثّق ومنشور على الموقع", 409);

    if (data.action === "schedule-content") {
      const when = data.scheduledAt ? new Date(data.scheduledAt) : new Date(Date.now() + 3600_000);
      if (Number.isNaN(when.getTime())) return fail("وقت الجدولة غير صحيح", 422);
      const result = await scheduleContent(item.id, when);
      await writeAudit({
        actorId: user?.id,
        action: "social.schedule_content",
        entityType: "ContentItem",
        entityId: item.id,
        detail: { when: when.toISOString(), platforms: result.platforms },
        ip: clientIp(req),
      });
      return ok({ ...result, scheduledAt: when.toISOString() });
    }

    const { outcomes, drafts } = await publishContent(item.id);
    await writeAudit({
      actorId: user?.id,
      action: "social.publish_content",
      entityType: "ContentItem",
      entityId: item.id,
      detail: { channels: outcomes.length, ok: outcomes.filter((o) => o.ok).length },
      ip: clientIp(req),
    });
    return ok({ outcomes, drafts });
  } catch (err) {
    return handleError(err);
  }
}
