import { z } from "zod";
import { requirePermission, currentUser } from "@/lib/auth";
import { handleError, ok, writeAudit } from "@/lib/http";
import { getBrand, updateBrand } from "@/lib/platform/brand";
import { listPlatformEmails, platformAddress, platformDomain } from "@/lib/platform/email";
import { ensureSystemPages, listPages } from "@/lib/platform/pages";
import { detectDrift } from "@/lib/security/config";

export async function GET() {
  try {
    await requirePermission("platform:manage");
    const [brand, emails, pages, drift] = await Promise.all([
      getBrand(),
      listPlatformEmails(),
      listPages(),
      detectDrift(),
    ]);
    return ok({
      brand,
      domain: platformDomain(),
      primaryEmail: platformAddress("INFO"),
      emails,
      pages,
      drift,
    });
  } catch (err) {
    return handleError(err);
  }
}

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  nameEn: z.string().min(2).max(80).optional(),
  tagline: z.string().max(120).optional(),
  slogan: z.string().max(200).optional(),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  website: z.string().url().optional().or(z.literal("")),
});

export async function PATCH(req: Request) {
  try {
    const actor = await requirePermission("platform:manage");
    const data = patchSchema.parse(await req.json());
    const brand = await updateBrand({ ...data, website: data.website === "" ? null : data.website }, actor?.id ?? null);
    await writeAudit({
      actorId: actor?.id,
      action: "platform.brand.update",
      entityType: "PlatformBrand",
      entityId: "main",
      detail: { fields: Object.keys(data) },
    });
    return ok({ brand });
  } catch (err) {
    return handleError(err);
  }
}

/** Register all known system pages on demand. */
export async function POST() {
  try {
    const actor = await currentUser();
    await requirePermission("platform:manage");
    const registered = await ensureSystemPages();
    await writeAudit({ actorId: actor?.id, action: "platform.pages.sync", entityType: "ManagedPage", detail: { registered } });
    return ok({ registered, pages: await listPages() });
  } catch (err) {
    return handleError(err);
  }
}
