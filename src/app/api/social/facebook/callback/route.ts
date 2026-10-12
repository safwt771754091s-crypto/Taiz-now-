import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { oauthRedirectUri, verifyState } from "@/lib/social/oauth";

const STATE_COOKIE = "fb_oauth_nonce";
const GRAPH = "https://graph.facebook.com/v25.0";

type GraphError = { error?: { message?: string } };

async function graph<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json()) as T & GraphError;
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  return json;
}

/**
 * OAuth callback: swap the code for a long-lived user token, read the admin's
 * Pages, then store a never-expiring Page token in the DB connection row so the
 * publisher can post without any .env edit.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error_description");

  const done = (params: Record<string, string>) =>
    NextResponse.redirect(`${origin}/social?${new URLSearchParams(params).toString()}`);

  if (denied) return done({ fb: "error", message: denied });
  if (!code || !state) return done({ fb: "error", message: "طلب غير صالح" });

  const payload = verifyState(state);
  const jar = await cookies();
  const nonce = jar.get(STATE_COOKIE)?.value;
  if (!payload || !nonce || !payload.startsWith(`${nonce}:`)) {
    return done({ fb: "error", message: "رمز الحماية (state) غير صالح" });
  }
  jar.delete(STATE_COOKIE);

  const appId = process.env.FACEBOOK_APP_ID!;
  const appSecret = process.env.FACEBOOK_APP_SECRET!;

  try {
    const tokenRes = await graph<{ access_token?: string }>(
      `${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}` +
        `&redirect_uri=${encodeURIComponent(oauthRedirectUri(origin, "facebook"))}` +
        `&code=${encodeURIComponent(code)}`,
    );
    const shortToken = tokenRes.access_token!;

    // Exchange BEFORE reading /me/accounts — a Page token minted from a
    // short-lived user token inherits the short lifetime.
    const longRes = await graph<{ access_token?: string }>(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}` +
        `&client_secret=${appSecret}&fb_exchange_token=${shortToken}`,
    );
    const longToken = longRes.access_token ?? shortToken;

    const accounts = await graph<{ data?: { id: string; name: string; access_token: string }[] }>(
      `${GRAPH}/me/accounts?fields=id,name,access_token&access_token=${longToken}`,
    );
    const page = accounts.data?.[0];
    if (!page) {
      return done({ fb: "error", message: "لا توجد صفحة يديرها هذا الحساب" });
    }

    const credentials = { FACEBOOK_PAGE_ID: page.id, FACEBOOK_ACCESS_TOKEN: page.access_token };
    await prisma.socialConnection.update({
      where: { provider: "facebook" },
      data: {
        mode: "LIVE",
        enabled: true,
        handle: `@${page.name}`,
        accountName: page.name,
        credentials,
      },
    });
    await prisma.platformIdentity.update({
      where: { provider: "facebook" },
      data: { handle: `@${page.name}`, connected: true, linkedVia: "oauth" },
    });

    return done({ fb: "ok", page: page.name });
  } catch (err) {
    return done({ fb: "error", message: (err as Error).message });
  }
}
