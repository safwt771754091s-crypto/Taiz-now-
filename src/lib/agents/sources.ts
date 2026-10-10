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
      return { title, link, summary, source: sourceLabel, publishedAt };
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
