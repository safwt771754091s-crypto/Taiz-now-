import { describe, expect, it } from "vitest";
import { analyzeMetadata, draftSocialPosts, AI_ENABLED } from "@/lib/ai";

describe("analyzeMetadata", () => {
  it("flags missing metadata as a risk", () => {
    const r = analyzeMetadata("image", null);
    expect(r.flags.length).toBeGreaterThan(0);
    expect(r.aiGeneratedProbability).toBeGreaterThanOrEqual(0.5);
  });

  it("detects AI software signatures", () => {
    const r = analyzeMetadata("image", { Software: "Midjourney v6" });
    expect(r.aiGeneratedProbability).toBeGreaterThan(0.8);
    expect(r.flags.join(" ")).toMatch(/الذكاء الاصطناعي/);
  });

  it("lowers AI probability when a camera device is present", () => {
    const r = analyzeMetadata("image", { Make: "Canon", Model: "EOS R6" });
    expect(r.aiGeneratedProbability).toBeLessThan(0.5);
    expect(r.findings.join(" ")).toMatch(/Canon/);
  });

  it("returns a deepfake signal only for video", () => {
    expect(analyzeMetadata("image", {}).deepfakeProbability).toBeNull();
    expect(analyzeMetadata("video", {}).deepfakeProbability).not.toBeNull();
  });
});

describe("draftSocialPosts", () => {
  it("produces a post for each platform with the confidence score", () => {
    const posts = draftSocialPosts({
      title: "عنوان الخبر",
      summary: "ملخص الخبر",
      confidence: 88,
      verdictLabel: "صحيح",
      slug: "demo-slug",
    });
    const platforms = posts.map((p) => p.platform);
    expect(platforms).toEqual(
      expect.arrayContaining(["website", "facebook", "x", "telegram", "instagram"]),
    );
    for (const p of posts) {
      expect(p.body).toContain("88");
      expect(p.body).toContain("عنوان الخبر");
    }
  });
});

describe("AI availability", () => {
  it("reports disabled when no key is configured", () => {
    expect(AI_ENABLED).toBe(false);
  });
});
