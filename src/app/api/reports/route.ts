import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser, requirePermission } from "@/lib/auth";
import { clientIp, fail, handleError, ok, writeAudit } from "@/lib/http";

const createSchema = z.object({
  type: z.enum(["NEWS", "IMAGE", "VIDEO", "MESSAGE", "OTHER"]).default("NEWS"),
  title: z.string().min(5, "العنوان قصير جداً").max(200),
  description: z.string().min(10, "الوصف قصير جداً").max(5000),
  mediaUrl: z.string().url().optional().or(z.literal("")),
  location: z.string().max(120).optional().or(z.literal("")),
  anonymous: z.boolean().default(false),
  reporterName: z.string().max(120).optional().or(z.literal("")),
  reporterContact: z.string().max(200).optional().or(z.literal("")),
});

export async function GET(req: Request) {
  try {
    await requirePermission("report:triage");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const reports = await prisma.report.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(type ? { type: type as never } : {}),
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: { assignedTo: { select: { name: true } }, _count: { select: { media: true, evidence: true } } },
    });
    return ok(reports);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = createSchema.parse(body);
    const user = await currentUser();

    // Reports are open to everyone, including anonymous submissions.
    const report = await prisma.report.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        mediaUrl: data.mediaUrl || null,
        location: data.location || null,
        anonymous: data.anonymous,
        reporterName: data.anonymous ? null : data.reporterName || user?.name || null,
        reporterContact: data.anonymous ? null : data.reporterContact || null,
        reporterId: data.anonymous ? null : user?.id ?? null,
      },
    });

    await writeAudit({
      actorId: user?.id ?? null,
      action: "report.create",
      entityType: "Report",
      entityId: report.id,
      detail: { type: data.type, anonymous: data.anonymous },
      ip: clientIp(req),
    });

    return ok({ id: report.id, status: report.status }, 201);
  } catch (err) {
    return handleError(err);
  }
}
