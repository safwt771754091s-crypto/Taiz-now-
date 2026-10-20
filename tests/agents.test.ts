import { describe, expect, it } from "vitest";
import { AGENT_CATALOG, AGENT_KIND_LABELS } from "@/lib/agents/catalog";
import { PROVIDERS, PROVIDER_MAP, providerEnvPresent, resolveMode } from "@/lib/social/providers";
import { draftRebuttal, writeProfessionally } from "@/lib/writer";
import { draftSocialPosts } from "@/lib/ai";
import { parseFeed, googleNewsFeedUrl, yemenFeeds, telegramChannelName, parseTelegramChannel, telegramSourceChannels, facebookSourcePages } from "@/lib/agents/sources";
import { normalizeTitle, similarTitles, publisherOf, minSources, looksAggregated, tokenize } from "@/lib/agents/autopublish";

describe("feed parser", () => {
  const rss = `<?xml version="1.0"?><rss><channel>
    <item><title>خبر أول</title><link>https://ex.test/1</link><description>ملخص أول</description><pubDate>Sat, 10 Oct 2026 08:15:45 GMT</pubDate></item>
    <item><title>خبر ثانٍ</title><link>https://ex.test/2</link><description>&lt;p&gt;ملخص مُرمّز&lt;/p&gt;</description></item>
  </channel></rss>`;

  it("parses RSS items and decodes entities and html", () => {
    const items = parseFeed(rss, "feed:test");
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("خبر أول");
    expect(items[0].link).toBe("https://ex.test/1");
    expect(items[1].summary).toBe("ملخص مُرمّز");
    expect(items[0].source).toBe("feed:test");
  });

  it("parses Atom entries with href links", () => {
    const atom = `<feed><entry><title>عنصر إخباري</title><link href="https://ex.test/a"/><summary>موجز</summary><updated>2026-10-10T10:00:00Z</updated></entry></feed>`;
    const items = parseFeed(atom, "feed:atom");
    expect(items).toHaveLength(1);
    expect(items[0].link).toBe("https://ex.test/a");
  });

  it("builds a Yemeni-Arabic Google News query url", () => {
    const url = googleNewsFeedUrl("تعز");
    expect(url).toContain("news.google.com/rss/search");
    expect(url).toContain("hl=ar");
    expect(url).toContain(encodeURIComponent("تعز"));
  });

  it("uses env SOURCE_FEEDS when provided", () => {
    process.env.SOURCE_FEEDS = "https://a.test/rss,https://b.test/rss";
    const feeds = yemenFeeds();
    expect(feeds).toHaveLength(2);
    expect(feeds[0].label).toBe("feed:a.test");
    delete process.env.SOURCE_FEEDS;
  });
});

describe("telegram source", () => {
  it("normalises @name, bare name and t.me urls to a channel name", () => {
    expect(telegramChannelName("@TaizNews")).toBe("TaizNews");
    expect(telegramChannelName("TaizNews")).toBe("TaizNews");
    expect(telegramChannelName("https://t.me/TaizNews")).toBe("TaizNews");
    expect(telegramChannelName("https://t.me/s/TaizNews/12")).toBe("TaizNews");
  });

  it("parses posts out of a public channel preview", () => {
    const html = `
      <div class="tgme_widget_message" data-post="Chan/7">
        <div class="tgme_widget_message_text js-message_text" dir="auto">خبر عاجل: انقطاع الكهرباء عن المدينة</div>
        <time datetime="2026-10-12T07:00:00+00:00"></time>
      </div>
      <div class="tgme_widget_message" data-post="Chan/8">
        <div class="tgme_widget_message_text js-message_text" dir="auto">شائعة: صورة قديمة تزعم حادثة اليوم</div>
      </div>`;
    const items = parseTelegramChannel(html, "Chan");
    expect(items).toHaveLength(2);
    expect(items[0].title).toContain("انقطاع الكهرباء");
    expect(items[0].link).toBe("https://t.me/Chan/7");
    expect(items[0].source).toBe("telegram:Chan");
    expect(items[0].publishedAt).toBe("2026-10-12T07:00:00+00:00");
  });

  it("reads watched channels from the environment", () => {
    process.env.TELEGRAM_SOURCE_CHANNELS = "@A, https://t.me/B";
    expect(telegramSourceChannels()).toEqual(["A", "B"]);
    delete process.env.TELEGRAM_SOURCE_CHANNELS;
  });

  it("reads watched facebook pages from the environment", () => {
    process.env.FACEBOOK_SOURCE_PAGES = "pageA,pageB";
    expect(facebookSourcePages()).toEqual(["pageA", "pageB"]);
    delete process.env.FACEBOOK_SOURCE_PAGES;
  });
});

describe("agent catalog", () => {
  it("defines the core agents with unique slugs", () => {
    const slugs = AGENT_CATALOG.map((a) => a.slug);
    expect(slugs).toEqual(["collector", "guardian", "monitor", "verifier", "writer", "publisher", "responder"]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every agent declares a kind with a label and non-empty capabilities", () => {
    for (const a of AGENT_CATALOG) {
      expect(AGENT_KIND_LABELS[a.kind]).toBeTruthy();
      expect(a.capabilities.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(10);
    }
  });
});

describe("social providers", () => {
  it("covers text, image and video channels", () => {
    const media = new Set(PROVIDERS.map((p) => p.media));
    expect(media.has("text")).toBe(true);
    expect(media.has("image")).toBe(true);
    expect(media.has("video")).toBe(true);
  });

  it("website needs no credentials and is always live", () => {
    const def = PROVIDER_MAP.get("website")!;
    expect(providerEnvPresent(def)).toBe(true);
    expect(resolveMode(def)).toBe("LIVE");
  });

  it("providers with missing env fall back to MOCK mode", () => {
    const def = PROVIDER_MAP.get("telegram")!;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHANNEL_ID;
    expect(providerEnvPresent(def)).toBe(false);
    expect(resolveMode(def)).toBe("MOCK");
  });
});

describe("offline writer", () => {
  it("produces a professional piece containing the verdict and confidence", async () => {
    const piece = await writeProfessionally({
      title: "افتتاح طريق",
      summary: "تم افتتاح الطريق بعد انتهاء الأعمال.",
      verdictLabel: "صحيح",
      confidence: 88,
      sources: ["مصدر رسمي"],
    });
    expect(piece.body).toContain("88/100");
    expect(piece.body).toContain("مصدر رسمي");
    expect(piece.body.length).toBeGreaterThan(20);
  });

  it("drafts a polite rebuttal for a false claim", async () => {
    const piece = await draftRebuttal({
      title: "إشاعة إغلاق الجسر",
      summary: "لا يوجد إغلاق.",
      verdictLabel: "غير صحيح",
      confidence: 15,
    });
    expect(piece.headline).toContain("تفنيد");
    expect(piece.body).toContain("غير صحيح");
  });
});

describe("social post drafting", () => {
  it("creates one draft per platform with the article url", () => {
    const drafts = draftSocialPosts({
      title: "عنوان",
      summary: "ملخص",
      confidence: 90,
      verdictLabel: "موثق",
      slug: "my-slug",
      baseUrl: "https://example.test",
    });
    const platforms = drafts.map((d) => d.platform);
    expect(platforms).toContain("website");
    expect(platforms).toContain("facebook");
    expect(platforms).toContain("telegram");
    expect(drafts[0].body).toContain("https://example.test/news/my-slug");
  });
});

describe("corroboration auto-publish helpers", () => {
  it("normalises Arabic letters and strips the Google News publisher suffix", () => {
    expect(normalizeTitle("إحباط هجمات حوثية واسعة في تعز - الجزيرة نت")).toBe(
      "احباط هجمات حوثيه واسعه في تعز",
    );
    expect(normalizeTitle("أحمد وإبراهيم — تعز")).toBe("احمد وابراهيم تعز");
  });

  it("treats the same story from two outlets as similar", () => {
    const a = "مقتل وإصابة 3 مدنيين جراء استهداف الحوثيين سيارة إسعاف في تعز - يمن مونيتور";
    const b = "قصف حوثي يستهدف سيارة إسعاف في تعز ويودي بحياة سائقها ويصيب آخرين - المصدر أونلاين";
    expect(similarTitles(a, b)).toBe(true);
  });

  it("keeps unrelated stories apart even when they share one place", () => {
    const a = "مقتل وإصابة 3 مدنيين جراء استهداف الحوثيين سيارة إسعاف في تعز";
    const b = "الأمم المتحدة: الجوع يهدد أكثر من 600 ألف شخص في تعز اليمنية";
    expect(similarTitles(a, b)).toBe(false);
  });

  it("does not merge a live-blog headline with an unrelated story sharing a place", () => {
    const a = "فجر اليمن.. درع الوطن والعمالقة ينفيان شائعات الحوثي بانسحابهم من مناطق غرب مأرب";
    const b = "«التحالف» يعترض صاروخاً باتجاه الرياض... و«فجر اليمن» تضغط على الحوثيين";
    expect(similarTitles(a, b)).toBe(false);
  });

  it("recognises known-reputable publishers and rejects unknown ones", () => {
    expect(publisherOf("feed:google-news:تعز | الجزيرة نت")).toBe("الجزيرة");
    expect(publisherOf("feed:google-news:تعز | رويترز")).toBe("رويترز");
    expect(publisherOf("feed:google-news:تعز | مدونة مجهولة")).toBeNull();
  });

  it("flags live-blog / round-up headlines as aggregated", () => {
    expect(looksAggregated("اليمن مباشر.. مقتل 100 حوثي.. والتحالف يعترض صاروخاً")).toBe(true);
    expect(looksAggregated("أحداث وتطورات المعارك والمواجهات في اليمن")).toBe(true);
    expect(looksAggregated("القوات الحكومية تصد هجوماً حوثياً على تعز")).toBe(false);
  });

  it("drops stopwords regardless of hamza/ta-marbuta spelling", () => {
    const tokens = tokenize("أحداث وتطورات المعارك والمواجهات في تعز");
    expect(tokens).not.toContain("احداث");
    expect(tokens).not.toContain("تطورات");
    expect(tokens).not.toContain("مواجهات");
  });

  it("requires at least two corroborating sources", () => {
    const prev = process.env.AUTO_PUBLISH_MIN_SOURCES;
    delete process.env.AUTO_PUBLISH_MIN_SOURCES;
    expect(minSources()).toBe(2);
    process.env.AUTO_PUBLISH_MIN_SOURCES = "1"; // below the floor -> clamped to 2
    expect(minSources()).toBe(2);
    process.env.AUTO_PUBLISH_MIN_SOURCES = "3";
    expect(minSources()).toBe(3);
    if (prev === undefined) delete process.env.AUTO_PUBLISH_MIN_SOURCES;
    else process.env.AUTO_PUBLISH_MIN_SOURCES = prev;
  });
});
