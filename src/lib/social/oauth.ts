import { createHmac, timingSafeEqual } from "node:crypto";
import { PROVIDER_MAP } from "./providers";

const STATE_TTL_MS = 15 * 60 * 1000;

function secret(): string {
  return process.env.AUTH_SECRET ?? "dev-insecure-secret";
}

/** Sign the CSRF state so the callback can prove it originated here. */
export function signState(payload: string): string {
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** Validate a signed state; returns the payload or null when invalid/expired. */
export function verifyState(state: string): string | null {
  const idx = state.lastIndexOf(".");
  if (idx <= 0) return null;
  const payload = state.slice(0, idx);
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(state.slice(idx + 1));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [nonce, issuedAt] = payload.split(":");
  if (!nonce || !issuedAt || Date.now() - Number(issuedAt) > STATE_TTL_MS) return null;
  return payload;
}

export function oauthRedirectUri(origin: string, provider: string): string {
  return `${origin}/api/social/${provider}/callback`;
}

/** Build Meta's OAuth dialog URL for the requested provider. */
export function facebookAuthUrl(origin: string, state: string): string {
  const appId = process.env.FACEBOOK_APP_ID;
  if (!appId) throw new Error("FACEBOOK_APP_ID غير مُهيّأ");
  const def = PROVIDER_MAP.get("facebook")!;
  const url = new URL("https://www.facebook.com/v25.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", oauthRedirectUri(origin, "facebook"));
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", (def.scopes ?? []).join(","));
  return url.toString();
}
