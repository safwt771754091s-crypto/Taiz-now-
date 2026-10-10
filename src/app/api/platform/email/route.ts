import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { handleError, ok, writeAudit } from "@/lib/http";
import { getBrand } from "@/lib/platform/brand";
import {
  ensurePlatformEmails,
  linkGoogleAccount,
  listPlatformEmails,
  platformAddress,
  platformDomain,
} from "@/lib/platform/email";

export async function GET() {
  try {
    await requirePermission("platform:manage");
    return ok({
      domain: platformDomain(),
      emails: await listPlatformEmails(),
      suggested: {
        info: platformAddress("INFO"),
        support: platformAddress("SUPPORT"),
        noreply: platformAddress("NOREPLY"),
        security: platformAddress("SECURITY"),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

const postSchema = z.object({
  action: z.enum(["provision", "link-google"]),
  email: z.string().email().optional(),
});

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("platform:manage");
    const data = postSchema.parse(await req.json());

    if (data.action === "provision") {
      const brand = await getBrand();
      await ensurePlatformEmails(brand.name);
      await writeAudit({ actorId: actor?.id, action: "platform.email.provision", entityType: "PlatformEmailAccount" });
      return ok({ provisioned: true, emails: await listPlatformEmails() });
    }

    if (!data.email) return ok({ error: "البريد مطلوب" }, 400);
    const res = await linkGoogleAccount(data.email, actor?.id ?? null);
    await writeAudit({
      actorId: actor?.id,
      action: "platform.email.link_google",
      entityType: "PlatformIdentity",
      entityId: "google",
      detail: { email: res.address },
    });
    return ok({ linked: true, ...res, emails: await listPlatformEmails() });
  } catch (err) {
    return handleError(err);
  }
}
