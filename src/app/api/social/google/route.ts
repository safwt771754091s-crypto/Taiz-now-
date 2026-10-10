import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { clientIp, handleError, ok, writeAudit } from "@/lib/http";
import { linkGoogleAccount } from "@/lib/social/connect";

const schema = z.object({
  email: z.string().email(),
  handle: z.string().max(80).optional(),
});

/**
 * Link the platform's own Google account to the platform. This provisions the
 * Google-linked channels (e.g. YouTube) so they can be managed from one place.
 * When real OAuth credentials are configured this becomes a live token exchange.
 */
export async function POST(req: Request) {
  try {
    const user = await requirePermission("social:manage");
    const data = schema.parse(await req.json());
    const identities = await linkGoogleAccount(data);
    await writeAudit({
      actorId: user?.id,
      action: "social.google_link",
      detail: { email: data.email },
      ip: clientIp(req),
    });
    return ok({ identities });
  } catch (err) {
    return handleError(err);
  }
}
