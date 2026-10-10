import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { handleError, ok, writeAudit } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { approveBaseline, detectDrift, restoreBaseline, runIntegrityScan } from "@/lib/security/config";
import { SEVERITY_LABELS } from "@/lib/security/events";

export async function GET(req: Request) {
  try {
    await requirePermission("security:manage");
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind");
    const resolved = searchParams.get("resolved");
    const [events, drift, counts, snapshots] = await Promise.all([
      prisma.securityEvent.findMany({
        where: {
          ...(kind ? { kind: kind as never } : {}),
          ...(resolved === "true" ? { resolved: true } : resolved === "false" ? { resolved: false } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      detectDrift(),
      prisma.securityEvent.groupBy({ by: ["severity"], _count: { _all: true } }),
      prisma.configSnapshot.findMany({ where: { scope: "platform", approved: true }, orderBy: { createdAt: "desc" }, take: 5 }),
    ]);
    const severityCounts = Object.fromEntries(counts.map((c) => [SEVERITY_LABELS[c.severity], c._count._all]));
    return ok({ events, drift, severityCounts, baselines: snapshots });
  } catch (err) {
    return handleError(err);
  }
}

const actionSchema = z.object({
  action: z.enum(["scan", "approve-baseline", "restore", "resolve"]),
  id: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("security:manage");
    const data = actionSchema.parse(await req.json());

    if (data.action === "scan") {
      const result = await runIntegrityScan(actor?.id ?? null);
      await writeAudit({ actorId: actor?.id, action: "security.scan", entityType: "SecurityEvent", detail: { drifted: result.drifted } });
      return ok(result);
    }
    if (data.action === "approve-baseline") {
      const result = await approveBaseline(actor!.id);
      await writeAudit({ actorId: actor?.id, action: "security.baseline.approve", entityType: "ConfigSnapshot", detail: result });
      return ok(result);
    }
    if (data.action === "restore") {
      const result = await restoreBaseline(actor!.id);
      await writeAudit({ actorId: actor?.id, action: "security.restore", entityType: "ConfigSnapshot", detail: result });
      return ok(result);
    }
    if (data.action === "resolve" && data.id) {
      const resolved = await prisma.securityEvent.update({
        where: { id: data.id },
        data: { resolved: true, resolvedBy: actor!.id, resolvedAt: new Date() },
      });
      return ok({ resolved });
    }
    return ok({ error: "إجراء غير معروف" }, 400);
  } catch (err) {
    return handleError(err);
  }
}
