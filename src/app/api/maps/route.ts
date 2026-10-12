import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { clientIp, handleError, ok, writeAudit } from "@/lib/http";

const createSchema = z.object({
  label: z.string().min(2).max(160),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  category: z.enum(["verified", "rumor", "correction", "incident", "general"]).default("general"),
  description: z.string().max(1000).optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  contentItemId: z.string().max(40).optional(),
});

/** List map markers for the geo-verification map. */
export async function GET(req: Request) {
  try {
    await requirePermission("geo:verify");
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const markers = await prisma.mapMarker.findMany({
      where: category ? { category } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok(markers);
  } catch (err) {
    return handleError(err);
  }
}

/** Add a geo-verified location. Requires geo:verify. */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("geo:verify");
    const data = createSchema.parse(await req.json());
    const marker = await prisma.mapMarker.create({
      data: {
        label: data.label,
        lat: data.lat,
        lng: data.lng,
        category: data.category,
        description: data.description,
        confidence: data.confidence ?? 0,
        contentItemId: data.contentItemId ?? null,
      },
    });
    await writeAudit({
      actorId: user?.id,
      action: "marker.create",
      entityType: "MapMarker",
      entityId: marker.id,
      detail: { label: marker.label, category: marker.category },
      ip: clientIp(req),
    });
    return ok(marker, 201);
  } catch (err) {
    return handleError(err);
  }
}
