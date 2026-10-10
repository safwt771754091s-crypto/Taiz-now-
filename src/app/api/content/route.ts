import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { clientIp, handleError, ok, writeAudit } from "@/lib/http";
import { slugify } from "@/lib/slug";

const createSchema = z.object({
  kind: z.enum(["NEWS", "RUMOR", "CORRECTION"]),
  title: z.string().min(5).max(200),
  summary: z.string().min(5).max(1000),
  body: z.string().min(1).max(50000),
  claim: z.string().max(2000).optional(),
  correctionNote: z.string().max(2000).optional(),
  location: z.string().max(120).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  slug: z.string().max(200).optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind");
    const status = searchParams.get("status") ?? "PUBLISHED";
    const q = searchParams.get("q")?.trim();
    const take = Math.min(Number(searchParams.get("take") ?? 30), 100);
    const skip = Math.max(Number(searchParams.get("skip") ?? 0), 0);

    const items = await prisma.contentItem.findMany({
      where: {
        ...(kind ? { kind: kind as never } : {}),
        ...(status && status !== "ALL" ? { status: status as never } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { summary: { contains: q, mode: "insensitive" } },
                { body: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      take,
      skip,
      select: {
        id: true,
        kind: true,
        slug: true,
        title: true,
        summary: true,
        status: true,
        verdict: true,
        confidence: true,
        location: true,
        tags: true,
        publishedAt: true,
        lastReviewedAt: true,
      },
    });
    return ok(items);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requirePermission("content:create");
    const data = createSchema.parse(await req.json());
    const base = slugify(data.slug || data.title);
    let slug = base;
    // Ensure uniqueness without a hard failure.
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.contentItem.findUnique({ where: { slug } });
      if (!exists) break;
      slug = `${base}-${i + 2}`;
    }

    const item = await prisma.contentItem.create({
      data: {
        kind: data.kind,
        slug,
        title: data.title,
        summary: data.summary,
        body: data.body,
        claim: data.claim || null,
        correctionNote: data.correctionNote || null,
        location: data.location || null,
        tags: data.tags ?? [],
        status: "DRAFT",
        createdById: user?.id,
      },
    });
    await writeAudit({
      actorId: user?.id,
      action: "content.create",
      entityType: "ContentItem",
      entityId: item.id,
      detail: { kind: item.kind },
      ip: clientIp(req),
    });
    return ok(item, 201);
  } catch (err) {
    return handleError(err);
  }
}
