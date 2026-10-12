import { auth } from "@/lib/auth";
import { clientIp, ok } from "@/lib/http";
import { recordVisit } from "@/lib/analytics/visits";

export const dynamic = "force-dynamic";

/**
 * Public page-view beacon. Called from the client on every navigation so the
 * owner can see who is on the platform. Fire-and-forget: always answers 200.
 */
export async function POST(req: Request) {
  const h = req.headers;
  let path = "/";
  try {
    const body = (await req.json()) as { path?: string };
    if (body?.path) path = body.path;
  } catch {
    /* ignore empty body */
  }

  let userId: string | null = null;
  try {
    const session = await auth();
    userId = session?.user?.id ?? null;
  } catch {
    /* anonymous visit */
  }

  await recordVisit({
    path,
    referer: h.get("referer"),
    ip: clientIp(req),
    userAgent: h.get("user-agent"),
    country: h.get("x-vercel-ip-country"),
    city: h.get("x-vercel-ip-city"),
    userId,
  });

  return ok({ tracked: true });
}
