import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { clientIp, handleError, ok, writeAudit } from "@/lib/http";
import { analyzeMetadata } from "@/lib/ai";

const schema = z.object({
  kind: z.enum(["IMAGE", "VIDEO", "MESSAGE"]),
  url: z.string().min(1).max(2000),
  mimeType: z.string().max(120).optional(),
  byteSize: z.number().int().nonnegative().optional(),
  reportId: z.string().optional(),
  contentItemId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  reverseSearchHits: z.number().int().nonnegative().optional(),
  geoVerified: z.boolean().optional(),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
  capturedAt: z.string().datetime().optional(),
  device: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requirePermission("media:analyze");
    const data = schema.parse(await req.json());

    const kind = data.kind === "VIDEO" ? "video" : "image";
    const analysis = analyzeMetadata(kind, data.metadata ?? null);

    // Reverse-search signal increases the AI/deepfake risk if the asset appeared earlier.
    const hits = data.reverseSearchHits ?? null;
    let aiProb = analysis.aiGeneratedProbability;
    const deepfake = analysis.deepfakeProbability;
    const flags = [...analysis.flags];
    if (hits && hits > 0) {
      flags.push(`عُثر على المادة (${hits}) مرة سابقة — قد تكون معاد استخدامها خارج سياقها`);
      aiProb = Math.max(aiProb, 0.6);
    }

    const asset = await prisma.mediaAsset.create({
      data: {
        kind: data.kind,
        url: data.url,
        mimeType: data.mimeType ?? null,
        byteSize: data.byteSize ?? null,
        reportId: data.reportId ?? null,
        contentItemId: data.contentItemId ?? null,
        metadata: (data.metadata ?? undefined) as object | undefined,
        capturedAt: data.capturedAt ? new Date(data.capturedAt) : null,
        gpsLat: data.gpsLat ?? null,
        gpsLng: data.gpsLng ?? null,
        device: data.device ?? null,
        aiGeneratedProbability: aiProb,
        deepfakeProbability: deepfake,
        reverseSearchHits: hits,
        geoVerified: data.geoVerified ?? false,
        analysisNotes: [...analysis.findings, ...flags].join("\n"),
        status: "ANALYZED",
        reviewedById: user?.id,
      },
    });

    await writeAudit({
      actorId: user?.id,
      action: "media.analyze",
      entityType: "MediaAsset",
      entityId: asset.id,
      detail: { kind: data.kind, aiProb, flags: flags.length },
      ip: clientIp(req),
    });

    return ok({ asset, analysis: { ...analysis, aiGeneratedProbability: aiProb, flags } }, 201);
  } catch (err) {
    return handleError(err);
  }
}
