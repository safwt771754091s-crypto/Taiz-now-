import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { handleError, ok, writeAudit } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { createManagedPage, ensureSystemPages, listPages } from "@/lib/platform/pages";

export async function GET() {
  try {
    await requirePermission("platform:manage");
    return ok({ pages: await listPages() });
  } catch (err) {
    return handleError(err);
  }
}

const createSchema = z.object({
  title: z.string().min(2).max(120),
  slug: z.string().min(2).max(60),
  kind: z.enum(["LANDING", "SECTION", "PLATFORM", "CONTACT", "LEGAL", "OTHER"]).optional(),
  description: z.string().max(300).optional(),
  navOrder: z.number().int().min(0).max(999).optional(),
  icon: z.string().max(40).optional(),
  tags: z.array(z.string().max(40)).max(10).optional(),
});

/** Create a new page (agent-built, served at /p/{slug}). */
export async function POST(req: Request) {
  try {
    const actor = await requirePermission("platform:manage");
    const data = createSchema.parse(await req.json());
    const page = await createManagedPage(data, actor?.id ?? null, true);
    await writeAudit({
      actorId: actor?.id,
      action: "platform.page.create",
      entityType: "ManagedPage",
      entityId: page.id,
      detail: { route: page.route },
    });
    return ok({ page }, 201);
  } catch (err) {
    return handleError(err);
  }
}

/** Sync the system page registry. */
export async function PUT() {
  try {
    const actor = await requirePermission("platform:manage");
    const registered = await ensureSystemPages();
    await writeAudit({ actorId: actor?.id, action: "platform.pages.sync", entityType: "ManagedPage", detail: { registered } });
    return ok({ registered, pages: await listPages() });
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  id: z.string(),
  title: z.string().min(2).max(120).optional(),
  published: z.boolean().optional(),
  navOrder: z.number().int().min(0).max(999).optional(),
});

export async function PATCH(req: Request) {
  try {
    const actor = await requirePermission("platform:manage");
    const { id, ...rest } = patchSchema.parse(await req.json());
    const page = await prisma.managedPage.update({ where: { id }, data: rest });
    await writeAudit({
      actorId: actor?.id,
      action: "platform.page.update",
      entityType: "ManagedPage",
      entityId: id,
      detail: rest,
    });
    return ok({ page });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await requirePermission("platform:manage");
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return ok({ error: "id مطلوب" }, 400);
    const page = await prisma.managedPage.findUnique({ where: { id } });
    if (!page) return ok({ error: "الصفحة غير موجودة" }, 404);
    if (page.systemRoute) return ok({ error: "لا يمكن حذف صفحة نظام" }, 400);
    await prisma.managedPage.delete({ where: { id } });
    await writeAudit({ actorId: actor?.id, action: "platform.page.delete", entityType: "ManagedPage", entityId: id });
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
