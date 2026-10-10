import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { clientIp, handleError, ok, writeAudit } from "@/lib/http";
import { analyzeClaim, draftSocialPosts } from "@/lib/ai";
import { score, type ConfidenceSignals } from "@/lib/confidence";
import { CONTENT_STATUS_LABELS, VERDICT_LABELS } from "@/lib/labels";
import type { ContentStatus } from "@prisma/client";

const patchSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  summary: z.string().min(5).max(1000).optional(),
  body: z.string().min(1).max(50000).optional(),
  claim: z.string().max(2000).nullable().optional(),
  correctionNote: z.string().max(2000).nullable().optional(),
  location: z.string().max(120).nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

const actionSchema = z.object({
  action: z.enum(["verify", "publish", "retract", "draft-social", "polish"]),
  signals: z
    .object({
      source: z.number().min(0).max(100),
      content: z.number().min(0).max(100),
      image: z.number().min(0).max(100),
      video: z.number().min(0).max(100),
      context: z.number().min(0).max(100),
      human: z.number().min(0).max(100),
    })
    .partial()
    .optional(),
  evidenceText: z.string().max(10000).optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const item = await prisma.contentItem.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        evidence: { include: { source: true } },
        scores: { orderBy: { computedAt: "desc" }, take: 5 },
        media: true,
        markers: true,
        socialPosts: true,
        createdBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
    });
    if (!item) return ok(null, 404);
    return ok(item);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("content:edit");
    const { id } = await ctx.params;
    const data = patchSchema.parse(await req.json());
    const item = await prisma.contentItem.update({ where: { id }, data });
    await writeAudit({
      actorId: user?.id,
      action: "content.update",
      entityType: "ContentItem",
      entityId: id,
      ip: clientIp(req),
    });
    return ok(item);
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Editor/verifier actions on a content item:
 *  - verify: run AI-assisted analysis to produce a draft score, then persist a
 *    confidence record (a human may override the signals explicitly).
 *  - publish: move to PUBLISHED (requires content:publish and a score > 0).
 *  - retract: mark RETRACTED.
 *  - draft-social: generate per-platform social post drafts.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = actionSchema.parse(await req.json());
    const item = await prisma.contentItem.findUnique({ where: { id }, include: { evidence: true } });
    if (!item) return ok(null, 404);

    if (body.action === "verify") {
      const user = await requirePermission("content:verify");
      let signals: ConfidenceSignals;
      let reasoning = "";

      if (body.signals) {
        signals = {
          source: body.signals.source ?? 0,
          content: body.signals.content ?? 0,
          image: body.signals.image ?? 0,
          video: body.signals.video ?? 0,
          context: body.signals.context ?? 0,
          human: body.signals.human ?? 0,
        };
      } else {
        const analysis = await analyzeClaim({
          claim: item.claim || item.title,
          evidenceText: body.evidenceText ?? item.evidence.map((e) => e.title).join("\n"),
        });
        signals = analysis.suggestedSignals;
        reasoning = analysis.reasoning;
      }

      const result = score(signals);
      const [record] = await prisma.$transaction([
        prisma.confidenceRecord.create({
          data: {
            entityType: "ContentItem",
            entityId: item.id,
            contentItemId: item.id,
            sourceScore: signals.source,
            contentScore: signals.content,
            imageScore: signals.image,
            videoScore: signals.video,
            contextScore: signals.context,
            humanScore: signals.human,
            total: result.total,
            verdict: result.verdict,
            breakdown: { ...result, reasoning },
            computedById: user?.id,
          },
        }),
        prisma.contentItem.update({
          where: { id: item.id },
          data: {
            confidence: result.total,
            verdict: result.verdict,
            status: "IN_REVIEW",
            lastReviewedAt: new Date(),
            reviewedById: user?.id,
          },
        }),
      ]);

      await writeAudit({
        actorId: user?.id,
        action: "content.verify",
        entityType: "ContentItem",
        entityId: item.id,
        detail: { total: result.total, verdict: result.verdict },
        ip: clientIp(req),
      });

      return ok({
        record,
        result,
        reasoning,
      });
    }

    if (body.action === "publish") {
      const user = await requirePermission("content:publish");
      const published: ContentStatus = "PUBLISHED";
      const updated = await prisma.contentItem.update({
        where: { id: item.id },
        data: {
          status: published,
          publishedAt: item.publishedAt ?? new Date(),
          lastReviewedAt: new Date(),
          reviewedById: user?.id,
        },
      });
      await writeAudit({
        actorId: user?.id,
        action: "content.publish",
        entityType: "ContentItem",
        entityId: item.id,
        ip: clientIp(req),
      });
      return ok(updated);
    }

    if (body.action === "retract") {
      const user = await requirePermission("content:publish");
      const updated = await prisma.contentItem.update({
        where: { id: item.id },
        data: { status: "RETRACTED", lastReviewedAt: new Date(), reviewedById: user?.id },
      });
      await writeAudit({
        actorId: user?.id,
        action: "content.retract",
        entityType: "ContentItem",
        entityId: item.id,
        ip: clientIp(req),
      });
      return ok(updated);
    }

    // polish — professionally rewrite a verified item via the Writer agent
    if (body.action === "polish") {
      const user = await requirePermission("content:edit");
      const { writeProfessionally } = await import("@/lib/writer");
      const piece = await writeProfessionally({
        title: item.title,
        summary: item.summary,
        body: item.body,
        verdictLabel: VERDICT_LABELS[item.verdict] ?? "",
        confidence: item.confidence,
        location: item.location,
        sources: item.evidence.map((e) => e.title),
      });
      const updated = await prisma.contentItem.update({
        where: { id: item.id },
        data: { body: piece.body },
      });
      await writeAudit({
        actorId: user?.id,
        action: "content.polish",
        entityType: "ContentItem",
        entityId: item.id,
        detail: { aiGenerated: piece.aiGenerated, model: piece.model },
        ip: clientIp(req),
      });
      return ok({ item: updated, piece });
    }

    // draft-social
    const user = await requirePermission("social:manage");
    const drafts = draftSocialPosts({
      title: item.title,
      summary: item.summary,
      confidence: item.confidence,
      verdictLabel: VERDICT_LABELS[item.verdict] ?? CONTENT_STATUS_LABELS[item.status],
      slug: item.slug,
    });
    await prisma.$transaction(
      drafts.map((d) =>
        prisma.socialPost.create({
          data: { platform: d.platform, body: d.body, status: "draft", contentItemId: item.id },
        }),
      ),
    );
    await writeAudit({
      actorId: user?.id,
      action: "social.draft",
      entityType: "ContentItem",
      entityId: item.id,
      detail: { platforms: drafts.map((d) => d.platform) },
      ip: clientIp(req),
    });
    return ok(drafts);
  } catch (err) {
    return handleError(err);
  }
}
