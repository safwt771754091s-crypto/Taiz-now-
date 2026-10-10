import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";
import { ensureConnections } from "@/lib/social/connect";
import { PROVIDERS } from "@/lib/social/providers";

/** List social connections plus the platform's linked identities. */
export async function GET() {
  try {
    await requirePermission("social:manage");
    await ensureConnections();
    const [connections, identities] = await Promise.all([
      prisma.socialConnection.findMany({ orderBy: { provider: "asc" } }),
      prisma.platformIdentity.findMany({ orderBy: { provider: "asc" } }),
    ]);
    const posts = await prisma.socialPost.groupBy({
      by: ["platform", "status"],
      _count: { _all: true },
    });
    return ok({ connections, identities, posts, providers: PROVIDERS });
  } catch (err) {
    return handleError(err);
  }
}
