import { describe, expect, it } from "vitest";
import { AGENT_CATALOG, AGENT_KIND_LABELS } from "@/lib/agents/catalog";
import { PROVIDERS, PROVIDER_MAP, providerEnvPresent, resolveMode } from "@/lib/social/providers";
import { draftRebuttal, writeProfessionally } from "@/lib/writer";
import { draftSocialPosts } from "@/lib/ai";

describe("agent catalog", () => {
  it("defines the five core agents with unique slugs", () => {
    const slugs = AGENT_CATALOG.map((a) => a.slug);
    expect(slugs).toEqual(["monitor", "verifier", "writer", "publisher", "responder"]);
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
