import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { facebookAuthUrl, signState } from "@/lib/social/oauth";

const STATE_COOKIE = "fb_oauth_nonce";

/**
 * Start "Login with Facebook": redirect the admin to Meta's OAuth dialog.
 * The app stays in Development mode, so publishing to the admin's own Page
 * needs no App Review — the admin holds a role on the app.
 */
export async function GET(req: Request) {
  await requirePermission("social:manage");
  const origin = new URL(req.url).origin;
  const nonce = randomUUID();
  const state = signState(`${nonce}:${Date.now()}`);

  const jar = await cookies();
  jar.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https"),
    path: "/",
    maxAge: 15 * 60,
  });

  return NextResponse.redirect(facebookAuthUrl(origin, state));
}
