import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";
import { BAND_LABELS, CONTENT_KIND_LABELS, REPORT_TYPE_LABELS, VERDICT_LABELS } from "@/lib/labels";

describe("slugify", () => {
  it("keeps Arabic letters and lowercases latin", () => {
    expect(slugify("اتفاق وقف إطلاق النار")).toBe("اتفاق-وقف-إطلاق-النار");
    expect(slugify("Taiz Now Report")).toBe("taiz-now-report");
  });

  it("collapses separators and trims edge dashes", () => {
    expect(slugify("  a // b \\ c  ")).toBe("a-b-c");
    expect(slugify("---x---")).toBe("x");
  });

  it("falls back to a generated slug for empty input", () => {
    expect(slugify("!!!")).toMatch(/^item-\d+$/);
  });
});

describe("labels", () => {
  it("covers every verdict with an Arabic label", () => {
    for (const label of Object.values(VERDICT_LABELS)) {
      expect(label).toMatch(/[\u0600-\u06FF]/);
    }
  });

  it("maps the documented confidence bands", () => {
    expect(BAND_LABELS.verified).toBe("موثق");
    expect(BAND_LABELS.false).toBe("غير صحيح");
  });

  it("has Arabic labels for content kinds and report types", () => {
    expect(CONTENT_KIND_LABELS.NEWS).toBeTruthy();
    expect(CONTENT_KIND_LABELS.RUMOR).toBeTruthy();
    expect(CONTENT_KIND_LABELS.CORRECTION).toBeTruthy();
    expect(REPORT_TYPE_LABELS.IMAGE).toBeTruthy();
    expect(REPORT_TYPE_LABELS.VIDEO).toBeTruthy();
  });
});
