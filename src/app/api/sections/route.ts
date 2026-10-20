import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { handleError, ok, writeAudit } from "@/lib/http";
import { createSection, ensureDefaultSections, listSections } from "@/lib/platform/sections";

export async function GET(req: Request) {
  try {
    await requirePermission("platform:manage");
    const { searchParams } = new URL(req.url);
    const onlyPublished = searchParams.get("published") === "1";
    // Make sure the seeded sections exist before listing.
    await ensureDefaultSections();
    return ok({ sections: await listSections({ onlyPublished }) });
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  title: z.string().min(2).max(120),
  slug: z.string().max(60).optional(),
  titleEn: z.string().max(120).optional(),
  description: z.string().max(300).optional(),
  icon: z.string().max(8).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  navOrder: z.number().int().min(0).max(999).optional(),
  published: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("platform:manage");
    const data = createSchema.parse(await req.json());
    const section = await createSection(data);
    await writeAudit({
      actorId: actor?.id,
      action: "section.create",
      entityType: "Section",
      entityId: section.id,
      detail: { slug: section.slug },
    });
    return ok({ section }, 201);
  } catch (err) {
    return handleError(err);
  }
}
