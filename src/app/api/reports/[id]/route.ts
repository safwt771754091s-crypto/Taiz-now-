import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, currentUser } from "@/lib/auth";
import { clientIp, handleError, ok, writeAudit } from "@/lib/http";

const updateSchema = z.object({
  status: z.enum(["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED", "DUPLICATE"]).optional(),
  priority: z.number().int().min(0).max(9).optional(),
  assignedToId: z.string().nullable().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("report:triage");
    const { id } = await ctx.params;
    const report = await prisma.report.findUnique({
      where: { id },
      include: {
        media: true,
        evidence: { include: { source: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    });
    if (!report) return ok(null, 404);
    return ok(report);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission("report:triage");
    const { id } = await ctx.params;
    const data = updateSchema.parse(await req.json());
    const report = await prisma.report.update({ where: { id }, data });
    await writeAudit({
      actorId: user?.id,
      action: "report.update",
      entityType: "Report",
      entityId: id,
      detail: data,
      ip: clientIp(req),
    });
    return ok(report);
  } catch (err) {
    return handleError(err);
  }
}
