import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { clientIp, handleError, ok, writeAudit } from "@/lib/http";
import { analyzeClaim } from "@/lib/ai";
import { score } from "@/lib/confidence";

const schema = z.object({
  claim: z.string().min(5).max(4000),
  evidenceText: z.string().max(10000).optional(),
  sourceReliability: z.number().int().min(0).max(100).optional(),
  persist: z.boolean().optional(),
  contentItemId: z.string().optional(),
});

/**
 * Runs the AI-assisted (or offline heuristic) claim analysis and returns a
 * suggested confidence score. Analysis is advisory; a human verifier owns the
 * final decision. Nothing is published from here.
 */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("content:verify");
    const data = schema.parse(await req.json());

    const analysis = await analyzeClaim({
      claim: data.claim,
      evidenceText: data.evidenceText,
      sourceReliability: data.sourceReliability,
    });
    const result = score(analysis.suggestedSignals);

    await writeAudit({
      actorId: user?.id,
      action: "analysis.claim",
      entityType: data.contentItemId ? "ContentItem" : undefined,
      entityId: data.contentItemId,
      detail: { aiGenerated: analysis.aiGenerated, total: result.total },
      ip: clientIp(req),
    });

    return ok({
      analysis,
      confidence: result,
      disclaimer:
        "هذه النتيجة استرشادية آلية ولا تُنشر تلقائياً. القرار النهائي للمدقق البشري.",
    });
  } catch (err) {
    return handleError(err);
  }
}
