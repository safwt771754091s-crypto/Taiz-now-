import { z } from "zod";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handleError, writeAudit } from "@/lib/http";

const GRAPH = "https://graph.facebook.com/v25.0";

const schema = z.object({
  /** A user token pasted from Graph API Explorer. */
  userToken: z.string().min(20),
  /**
   * Optional App Secret. Supplying it lets us exchange the pasted short-lived
   * token for a long-lived one, whose Page token never expires. It is used once
   * for the exchange and never persisted.
   */
  appSecret: z.string().min(10).optional(),
});

type GraphError = { error?: { message?: string } };

async function graph<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json()) as T & GraphError;
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  return json;
}

/**
 * Manual Facebook connect: the admin pastes a short-lived user token from the
 * Graph API Explorer. We exchange it for a long-lived token, read their Pages,
 * and persist a never-expiring Page token — same result as the OAuth flow but
 * without any redirect URI, which keeps working even when the Meta app has no
 * Facebook Login product configured.
 */
export async function POST(req: Request) {
  try {
    return await handleToken(req);
  } catch (err) {
    return handleError(err);
  }
}

async function handleToken(req: Request) {
  const user = await requirePermission("social:manage");
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.json({ error: "FACEBOOK_APP_ID/SECRET غير مُهيّأ" }, { status: 400 });
  }

  let userToken: string;
  let suppliedSecret: string | undefined;
  try {
    const parsed = schema.parse(await req.json());
    userToken = parsed.userToken.trim();
    suppliedSecret = parsed.appSecret?.trim() || undefined;
  } catch {
    return NextResponse.json({ error: "التوكن مطلوب" }, { status: 400 });
  }

  // Prefer a secret supplied in the request (the admin may not want it in .env),
  // then fall back to the configured one.
  const secret = suppliedSecret ?? appSecret;

  try {
    // Prefer a long-lived token, but a token from the Graph API Explorer is
    // often already long-lived — or the app secret may be unavailable. Either
    // way, fall back to the pasted token so Page discovery still works.
    let longToken = userToken;
    let exchanged = false;
    try {
      const longRes = await graph<{ access_token?: string }>(
        `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}` +
          `&client_secret=${secret}&fb_exchange_token=${encodeURIComponent(userToken)}`,
      );
      if (longRes.access_token) {
        longToken = longRes.access_token;
        exchanged = true;
      }
    } catch {
      // ignore — use the token as-is
    }

    const accounts = await graph<{ data?: { id: string; name: string; access_token: string }[] }>(
      `${GRAPH}/me/accounts?fields=id,name,access_token&access_token=${longToken}`,
    );
    const page = accounts.data?.[0];
    if (!page) {
      return NextResponse.json({ error: "لا توجد صفحة يديرها هذا الحساب" }, { status: 400 });
    }

    // Posting needs pages_manage_posts; without it the token connects but every
    // publish fails, so surface the exact missing scope up front.
    const debug = await graph<{ data?: { scopes?: string[]; expires_at?: number } }>(
      `${GRAPH}/debug_token?input_token=${encodeURIComponent(longToken)}&access_token=${encodeURIComponent(longToken)}`,
    ).catch(() => ({ data: {} as { scopes?: string[]; expires_at?: number } }));
    const scopes = debug.data?.scopes ?? [];
    if (!scopes.includes("pages_manage_posts")) {
      return NextResponse.json(
        {
          error:
            "التوكن لا يملك صلاحية pages_manage_posts (النشر). أعد توليده من Graph API Explorer مع إضافة هذه الصلاحية.",
          scopes,
        },
        { status: 400 },
      );
    }

    const credentials = { FACEBOOK_PAGE_ID: page.id, FACEBOOK_ACCESS_TOKEN: page.access_token };
    // A Page token derived from a short-lived user token inherits its expiry; warn
    // the admin before it silently dies mid-publish. A token minted from a
    // long-lived exchange (or one that never expires) reports no expires_at.
    const pageDebug = await graph<{ data?: { expires_at?: number } }>(
      `${GRAPH}/debug_token?input_token=${encodeURIComponent(page.access_token)}` +
        `&access_token=${encodeURIComponent(longToken)}`,
    ).catch(() => ({ data: {} as { expires_at?: number } }));
    const rawExpiry = pageDebug.data?.expires_at ?? debug.data?.expires_at;
    const expiresAt = rawExpiry ? new Date(rawExpiry * 1000) : null;
    const permanent = !expiresAt;
    await prisma.socialConnection.update({
      where: { provider: "facebook" },
      data: { mode: "LIVE", enabled: true, handle: `@${page.name}`, accountName: page.name, credentials, expiresAt },
    });
    await prisma.platformIdentity.update({
      where: { provider: "facebook" },
      data: { handle: `@${page.name}`, connected: true, linkedVia: "token" },
    });
    await writeAudit({
      actorId: user?.id,
      action: "social.connect",
      entityType: "SocialConnection",
      detail: { provider: "facebook", method: "token", permanent, exchanged },
    });

    return NextResponse.json({
      data: { page: page.name, pageId: page.id, permanent, exchanged },
      message: permanent
        ? "تم الربط بتوكن دائم ♾️ — لن ينتهي."
        : "تم الربط، لكن التوكن مؤقت. أضف المفتاح السري للتطبيق لتوليد توكن دائم.",
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
