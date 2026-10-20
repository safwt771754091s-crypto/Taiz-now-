import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";

/** Owner-only activity feed: the audit log joined with the actor's name. */
export async function GET(req: Request) {
  try {
    await requirePermission("platform:manage");
    const { searchParams } = new URL(req.url);
    const take = Math.min(Number(searchParams.get("take") ?? 50), 200);
    const q = searchParams.get("q")?.trim();

    const logs = await prisma.auditLog.findMany({
      where: q ? { action: { contains: q, mode: "insensitive" } } : undefined,
      orderBy: { createdAt: "desc" },
      take,
      include: { actor: { select: { name: true, email: true } } },
    });

    return ok({
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        actor: l.actor?.name ?? "النظام",
        detail: l.detail,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
