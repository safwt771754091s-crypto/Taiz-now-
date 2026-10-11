import { PROVIDER_MAP, providerEnvPresent } from "./providers";

export type DeliverResult = {
  ok: boolean;
  mode: "mock" | "live";
  externalId?: string;
  detail: string;
};

/**
 * Deliver a single post to a platform. Adapters are intentionally thin: when
 * real credentials are configured (LIVE) we call the provider API; otherwise we
 * record the post locally (MOCK) so the whole pipeline is testable end-to-end
 * without leaking secrets or requiring accounts.
 */
export async function deliver(args: {
  provider: string;
  handle?: string | null;
  body: string;
  url?: string;
  /** Public image URL, required by image-first channels (Instagram). */
  imageUrl?: string;
}): Promise<DeliverResult> {
  const def = PROVIDER_MAP.get(args.provider);
  if (!def) {
    return { ok: false, mode: "mock", detail: `منصة غير معروفة: ${args.provider}` };
  }

  if (args.provider === "website") {
    return { ok: true, mode: "mock", detail: "نُشر على موقع المنصة." };
  }

  const live = providerEnvPresent(def);
  if (!live) {
    return {
      ok: true,
      mode: "mock",
      detail: `سُجّل محلياً (وضع المحاكاة). أضف مفاتيح ${def.envKeys.join(", ")} لتفعيل النشر المباشر.`,
    };
  }

  try {
    if (args.provider === "telegram") {
      return await deliverTelegram(args);
    }
    if (args.provider === "facebook") {
      return await deliverFacebook(args);
    }
    if (args.provider === "whatsapp") {
      return await deliverWhatsapp(args);
    }
    if (args.provider === "x") {
      return await deliverX(args);
    }
    if (args.provider === "linkedin") {
      return await deliverLinkedin(args);
    }
    if (args.provider === "instagram") {
      return await deliverInstagram(args);
    }
    // Video-first channels need a media file, which the text pipeline cannot supply.
    return {
      ok: false,
      mode: "live",
      detail: `«${def.label}» منصة فيديو وتحتاج ملف وسائط — غير مدعومة عبر النشر النصي.`,
    };
  } catch (err) {
    return { ok: false, mode: "live", detail: `فشل النشر على ${def.label}: ${(err as Error).message}` };
  }
}

async function deliverTelegram(args: { handle?: string | null; body: string; url?: string }): Promise<DeliverResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const chatId = process.env.TELEGRAM_CHANNEL_ID || args.handle;
  const text = args.url ? `${args.body}\n\n${args.url}` : args.body;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: { message_id?: number } };
  if (!res.ok || !json.ok) {
    throw new Error(`telegram HTTP ${res.status}`);
  }
  return { ok: true, mode: "live", externalId: String(json.result?.message_id ?? ""), detail: "نُشر على تيليجرام." };
}

async function deliverFacebook(args: { body: string; url?: string }): Promise<DeliverResult> {
  const pageId = process.env.FACEBOOK_PAGE_ID!;
  const token = process.env.FACEBOOK_ACCESS_TOKEN!;
  const body = new URLSearchParams({ message: args.body, access_token: token });
  if (args.url) body.set("link", args.url);
  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, { method: "POST", body });
  const json = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `facebook HTTP ${res.status}`);
  return { ok: true, mode: "live", externalId: json.id ?? "", detail: "نُشر على فيسبوك." };
}

async function deliverWhatsapp(args: { handle?: string | null; body: string }): Promise<DeliverResult> {
  const phoneId = process.env.WHATSAPP_PHONE_ID!;
  const token = process.env.WHATSAPP_TOKEN!;
  const to = args.handle;
  if (!to) throw new Error("لا يوجد رقم مستلم");
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: args.body } }),
  });
  const json = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[]; error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `whatsapp HTTP ${res.status}`);
  return { ok: true, mode: "live", externalId: json.messages?.[0]?.id ?? "", detail: "أُرسل عبر واتساب." };
}

/** Post a tweet via the X (Twitter) API v2. Requires a user-context token. */
async function deliverX(args: { body: string }): Promise<DeliverResult> {
  const token = process.env.X_ACCESS_TOKEN || process.env.X_BEARER_TOKEN;
  if (!token) throw new Error("مفتاح X غير مُهيّأ");
  const text = args.body.length > 280 ? `${args.body.slice(0, 277)}…` : args.body;
  const res = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { id?: string };
    detail?: string;
    title?: string;
  };
  if (!res.ok) throw new Error(json.detail ?? json.title ?? `x HTTP ${res.status}`);
  return { ok: true, mode: "live", externalId: json.data?.id ?? "", detail: "نُشر على منصة X." };
}

/** Share a post on a LinkedIn organization (company) page. */
async function deliverLinkedin(args: { body: string; url?: string }): Promise<DeliverResult> {
  const author = process.env.LINKEDIN_ORGANIZATION_ID || process.env.LINKEDIN_AUTHOR_URN;
  const token = process.env.LINKEDIN_ACCESS_TOKEN!;
  if (!author) throw new Error("LINKEDIN_ORGANIZATION_ID (أو LINKEDIN_AUTHOR_URN) مطلوب");
  const owner = author.startsWith("urn:") ? author : `urn:li:organization:${author}`;
  const commentary = args.url ? `${args.body}\n\n${args.url}` : args.body;
  const payload: Record<string, unknown> = {
    author: owner,
    commentary,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED" },
    lifecycleState: "PUBLISHED",
  };
  if (args.url) payload.content = { article: { source: args.url } };
  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202410",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`linkedin HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return { ok: true, mode: "live", externalId: res.headers.get("x-restli-id") ?? "", detail: "نُشر على لينكدإن." };
}

/**
 * Publish to Instagram via the Instagram Graph API. Instagram needs a public
 * image URL (it fetches the media itself), so the caller must supply imageUrl.
 */
async function deliverInstagram(args: { body: string; imageUrl?: string }): Promise<DeliverResult> {
  const igId = process.env.INSTAGRAM_BUSINESS_ID!;
  const token = process.env.INSTAGRAM_ACCESS_TOKEN!;
  if (!args.imageUrl) throw new Error("إنستغرام يحتاج رابط صورة عام (imageUrl)");
  const create = await fetch(`https://graph.facebook.com/v21.0/${igId}/media`, {
    method: "POST",
    body: new URLSearchParams({ image_url: args.imageUrl, caption: args.body, access_token: token }),
  });
  const created = (await create.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!create.ok || created.error || !created.id) {
    throw new Error(created.error?.message ?? `instagram media HTTP ${create.status}`);
  }
  const publish = await fetch(`https://graph.facebook.com/v21.0/${igId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: created.id, access_token: token }),
  });
  const published = (await publish.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!publish.ok || published.error) throw new Error(published.error?.message ?? `instagram publish HTTP ${publish.status}`);
  return { ok: true, mode: "live", externalId: published.id ?? "", detail: "نُشر على إنستغرام." };
}
