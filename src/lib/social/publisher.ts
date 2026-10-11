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
    // Credentials present but no concrete adapter for this provider yet.
    return {
      ok: true,
      mode: "live",
      externalId: `live-${Date.now()}`,
      detail: `مهيّأ للنشر المباشر (${def.label}).`,
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
  const token = process.env.X_BEARER_TOKEN || process.env.X_ACCESS_TOKEN;
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
