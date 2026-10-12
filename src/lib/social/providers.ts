import type { ConnectionMode } from "@prisma/client";

export type ProviderDef = {
  provider: string;
  label: string;
  handlePrefix: string;
  /** Text / audio-visual / video-first — how the platform distributes. */
  media: "text" | "image" | "video" | "audio";
  /** Whether posts can be dispatched by the automation. */
  postable: boolean;
  /** Env var names that, when present, let the adapter publish for real. */
  envKeys: string[];
  /** OAuth scopes requested by the one-click connect flow, if supported. */
  scopes?: string[];
  color: string;
};

export const PROVIDERS: ProviderDef[] = [
  { provider: "website", label: "موقع المنصة", handlePrefix: "@", media: "text", postable: true, envKeys: [], color: "#0ea5e9" },
  { provider: "facebook", label: "فيسبوك", handlePrefix: "@", media: "image", postable: true, envKeys: ["FACEBOOK_PAGE_ID", "FACEBOOK_ACCESS_TOKEN"], scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"], color: "#1877f2" },
  { provider: "x", label: "منصة X (تويتر)", handlePrefix: "@", media: "text", postable: true, envKeys: ["X_ACCESS_TOKEN"], color: "#e7e9ea" },
  { provider: "instagram", label: "إنستغرام", handlePrefix: "@", media: "image", postable: true, envKeys: ["INSTAGRAM_BUSINESS_ID", "INSTAGRAM_ACCESS_TOKEN"], scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"], color: "#e1306c" },
  { provider: "telegram", label: "تيليجرام", handlePrefix: "@", media: "text", postable: true, envKeys: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHANNEL_ID"], color: "#26a5e4" },
  { provider: "whatsapp", label: "واتساب", handlePrefix: "+", media: "text", postable: true, envKeys: ["WHATSAPP_PHONE_ID", "WHATSAPP_TOKEN"], color: "#25d366" },
  { provider: "youtube", label: "يوتيوب", handlePrefix: "@", media: "video", postable: false, envKeys: ["YOUTUBE_CHANNEL_ID"], color: "#ff0000" },
  { provider: "tiktok", label: "تيك توك", handlePrefix: "@", media: "video", postable: false, envKeys: ["TIKTOK_ACCESS_TOKEN"], color: "#ff0050" },
  { provider: "linkedin", label: "لينكدإن", handlePrefix: "@", media: "text", postable: true, envKeys: ["LINKEDIN_ACCESS_TOKEN"], color: "#0a66c2" },
];

export const PROVIDER_MAP = new Map(PROVIDERS.map((p) => [p.provider, p]));

/** Providers the "connect with Google" flow can provision (Google-owned products). */
export const GOOGLE_LINKED_PROVIDERS = ["google", "youtube"];

export function providerEnvPresent(def: ProviderDef): boolean {
  if (def.envKeys.length === 0) return true; // website needs no credentials
  return def.envKeys.every((k) => Boolean(process.env[k]));
}

export function resolveMode(def: ProviderDef): ConnectionMode {
  return providerEnvPresent(def) ? "LIVE" : "MOCK";
}
