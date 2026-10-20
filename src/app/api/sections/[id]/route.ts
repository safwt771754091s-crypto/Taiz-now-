import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { handleError, ok, writeAudit } from "@/lib/http";
import { deleteSection, updateSection } from "@/lib/platform/sections";

const patchSchema = z.object({
  title: z.string().min(2).max(120).optional(),
  titleEn: z.string().max(120).nullable().optional(),
  description: z.string().max(300).nullable().optional(),
  icon: z.string().max(8).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  navOrder: z.number().int().min(0).max(999).optional(),
  published: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("platform:manage");
    const { id } = await ctx.params;
    const data = patchSchema.parse(await req.json());
    const section = await updateSection(id, data);
    await writeAudit({
      actorId: actor?.id,
      action: "section.update",
      entityType: "Section",
      entityId: id,
      detail: data,
    });
    return ok({ section });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("platform:manage");
    const { id } = await ctx.params;
    await deleteSection(id);
    await writeAudit({ actorId: actor?.id, action: "section.delete", entityType: "Section", entityId: id });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
