/**
 * External source collectors. These use plain HTTP + public feeds, so they need
 * no paid API keys and run anywhere. Inspired by the crawler/scraper building
 * blocks (Agent-Reach, crawl4ai, firecrawl, scrapling) without bundling them.
 */

export type FeedItem = {
  title: string;
  link: string;
  summary: string;
  source: string;
  /** The originating publisher (e.g. "الجزيرة نت"), when the feed exposes one. */
  publisher?: string;
  publishedAt?: string;
};

const UA =
  "Mozilla/5.0 (compatible; TaizNowBot/1.0; +https://github.com/safwt771754091s-crypto/Taiz-now-)";

/** Fetch and parse an RSS/Atom feed into normalised items. */
export async function collectFeed(feedUrl: string, sourceLabel: string): Promise<FeedItem[]> {
  const res = await fetch(feedUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
  const xml = await res.text();
  return parseFeed(xml, sourceLabel);
}

/** Parse RSS <item> and Atom <entry> blocks without external dependencies. */
export function parseFeed(xml: string, sourceLabel: string): FeedItem[] {
  const blocks = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const entries = blocks.length ? blocks : [...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map((m) => m[0]);
  return entries
    .map((block) => {
      const title = tag(block, "title");
      const link =
        tag(block, "link") ||
        (block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? "");
      const summary = stripHtml(tag(block, "description") || tag(block, "summary") || tag(block, "content"));
      const publishedAt = tag(block, "pubDate") || tag(block, "updated") || tag(block, "published");
      // Google News puts the originating outlet in <source>; other feeds name it
      // in <author>. Keep it so corroboration can tell publishers apart.
      const publisher =
        tag(block, "source") ||
        tag(block, "author") ||
        (block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "").trim();
      return { title, link, summary, source: sourceLabel, publisher: publisher || undefined, publishedAt };
    })
    .filter((it) => it.title.length > 4);
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? decodeEntities(m[1]).trim() : "";
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")).trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/** A Google News RSS search URL for a query, restricted to the Yemeni Arabic edition. */
export function googleNewsFeedUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ar&gl=YE&ceid=YE:ar`;
}

/** Default Yemen-focused queries the collector tracks. */
export const DEFAULT_YEMEN_QUERIES = ["تعز", "اليمن", "عدن", "صنعاء", "شائعة اليمن"];

/** Build the list of feeds the collector should poll (env-configurable). */
export function yemenFeeds(): { url: string; label: string }[] {
  const custom = (process.env.SOURCE_FEEDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (custom.length) return custom.map((url) => ({ url, label: `feed:${hostOf(url)}` }));
  return DEFAULT_YEMEN_QUERIES.map((q) => ({ url: googleNewsFeedUrl(q), label: `feed:google-news:${q}` }));
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "custom";
  }
}

/**
 * Claim a URL for deeper inspection and return readable text. Uses r.jina.ai
 * (free, keyless) which mirrors the `reader` building block you forked.
 */
export async function readArticle(url: string): Promise<string> {
  const res = await fetch(`https://r.jina.ai/${url}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`reader HTTP ${res.status}`);
  const text = await res.text();
  return text.replace(/\s+/g, " ").trim().slice(0, 4000);
}

// ─── Telegram (public channel web preview) ────────────────────────────────────
//
// Telegram exposes a keyless public preview of any channel at t.me/s/<name>.
// We read the posts that other people wrote there (the sources the platform
// watches), NOT the platform's own published channel — that one is an output.

/** Normalise "@name", "name" or "https://t.me/name" to a bare channel name. */
export function telegramChannelName(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\/(?:www\.)?t\.me\/(?:s\/)?/i, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "");
}

/** Parse the public preview HTML of a Telegram channel into feed items. */
export function parseTelegramChannel(html: string, channel: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const block of html.split('data-post="').slice(1)) {
    const post = block.slice(0, block.indexOf('"'));
    if (!post) continue;
    const textMatch = block.match(/js-message_text[^>]*>([\s\S]*?)<\/div>/);
    if (!textMatch) continue;
    const text = decodeEntities(
      textMatch[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " "),
    ).trim();
    if (text.length < 8) continue;
    const dateMatch = block.match(/<time datetime="([^"]+)"/);
    items.push({
      title: text.split("\n")[0].slice(0, 180),
      link: `https://t.me/${post}`,
      summary: text.slice(0, 2000),
      source: `telegram:${channel}`,
      publishedAt: dateMatch?.[1],
    });
  }
  return items;
}

/** Fetch and parse a public Telegram channel's recent posts. */
export async function collectTelegramChannel(channel: string): Promise<FeedItem[]> {
  const name = telegramChannelName(channel);
  if (!name) throw new Error("قناة تيليجرام غير معروفة");
  const res = await fetch(`https://t.me/s/${name}`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`telegram HTTP ${res.status}`);
  return parseTelegramChannel(await res.text(), name);
}

/** Telegram channels the collector should watch (env: TELEGRAM_SOURCE_CHANNELS). */
export function telegramSourceChannels(): string[] {
  return (process.env.TELEGRAM_SOURCE_CHANNELS || "")
    .split(",")
    .map((s) => telegramChannelName(s))
    .filter(Boolean);
}

// ─── Facebook (Graph API page feed) ───────────────────────────────────────────
//
// Reading other pages' posts needs a Page access token with pages_read_engagement
// (or a user token with the page you manage). When no token is configured we
// return an empty list rather than fail — the collector then simply has no
// Facebook source, exactly like an unconfigured RSS feed.

/** Page ids/slugs the collector should watch (env: FACEBOOK_SOURCE_PAGES). */
export function facebookSourcePages(): string[] {
  return (process.env.FACEBOOK_SOURCE_PAGES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Fetch recent posts from Facebook pages via the Graph API. */
export async function collectFacebookPages(
  pages: string[],
  token: string | undefined,
): Promise<FeedItem[]> {
  if (!token || pages.length === 0) return [];
  const items: FeedItem[] = [];
  for (const page of pages) {
    try {
      const url =
        `https://graph.facebook.com/v25.0/${encodeURIComponent(page)}/posts` +
        `?fields=message,created_time,permalink_url&limit=10&access_token=${encodeURIComponent(token)}`;
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const json = (await res.json().catch(() => ({}))) as {
        data?: { id?: string; message?: string; created_time?: string; permalink_url?: string }[];
      };
      for (const p of json.data ?? []) {
        const message = (p.message ?? "").trim();
        if (message.length < 8) continue;
        items.push({
          title: message.split("\n")[0].slice(0, 180),
          link: p.permalink_url || `https://www.facebook.com/${p.id ?? page}`,
          summary: message.slice(0, 2000),
          source: `facebook:${page}`,
          publishedAt: p.created_time,
        });
      }
    } catch {
      // A single unreachable page must not abort the whole collection.
    }
  }
  return items;
}
