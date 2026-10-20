import { describe, expect, it } from "vitest";
import { configHash } from "@/lib/security/config";
import { platformAddress, platformDomain, EMAIL_PREFIXES } from "@/lib/platform/email";
import { SYSTEM_PAGES, PAGE_KIND_LABELS } from "@/lib/platform/pages";
import { AGENT_CATALOG, AGENT_KIND_LABELS } from "@/lib/agents/catalog";
import { SEVERITY_LABELS, SEVERITY_ORDER } from "@/lib/security/events";
import { shouldAlert } from "@/lib/security/alerts";
import { maskValue, RECOVERY_KIND_LABELS } from "@/lib/security/recovery";


describe("config integrity hashing", () => {
  it("is deterministic regardless of object key order", () => {
    const a = { x: 1, y: { b: 2, a: 3 }, z: [1, 2, 3] };
    const b = { z: [1, 2, 3], y: { a: 3, b: 2 }, x: 1 };
    expect(configHash(a)).toBe(configHash(b));
  });

  it("changes when a value changes", () => {
    expect(configHash({ name: "تعز الآن" })).not.toBe(configHash({ name: "تعز غداً" }));
  });

  it("is a 64-char sha256 hex digest", () => {
    expect(configHash({ any: "thing" })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("platform email identity", () => {
  it("derives the standard mailboxes from the platform domain", () => {
    process.env.PLATFORM_DOMAIN = "taiznow.example";
    expect(platformDomain()).toBe("taiznow.example");
    expect(platformAddress("INFO")).toBe("info@taiznow.example");
    expect(platformAddress("SECURITY")).toBe("security@taiznow.example");
    expect(Object.values(EMAIL_PREFIXES)).toContain("noreply");
    delete process.env.PLATFORM_DOMAIN;
  });

  it("strips a leading @ from the configured domain", () => {
    process.env.PLATFORM_DOMAIN = "@taiznow.ye";
    expect(platformDomain()).toBe("taiznow.ye");
    delete process.env.PLATFORM_DOMAIN;
  });
});

describe("managed page registry", () => {
  it("registers every core route as a system page with unique routes", () => {
    const routes = SYSTEM_PAGES.map((p) => p.route);
    expect(new Set(routes).size).toBe(routes.length);
    for (const r of ["/", "/news", "/rumors", "/corrections", "/reports", "/maps", "/agents", "/platform", "/security"]) {
      expect(routes).toContain(r);
    }
  });

  it("has a kind label for every page kind used", () => {
    for (const p of SYSTEM_PAGES) expect(PAGE_KIND_LABELS[p.kind]).toBeTruthy();
  });
});

describe("guardian agent", () => {
  it("is present in the catalog with a labelled kind", () => {
    const guardian = AGENT_CATALOG.find((a) => a.slug === "guardian");
    expect(guardian).toBeTruthy();
    expect(guardian!.kind).toBe("GUARDIAN");
    expect(AGENT_KIND_LABELS.GUARDIAN).toBeTruthy();
    expect(guardian!.capabilities.length).toBeGreaterThan(0);
  });
});

describe("security severity scale", () => {
  it("orders severities and labels them", () => {
    expect(SEVERITY_ORDER).toEqual(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);
    for (const s of SEVERITY_ORDER) expect(SEVERITY_LABELS[s]).toBeTruthy();
  });
});

describe("security alert policy", () => {
  it("alerts only for high/critical security-relevant kinds", () => {
    expect(shouldAlert("BRAND_CHANGE", "HIGH")).toBe(true);
    expect(shouldAlert("PASSWORD_CHANGE", "CRITICAL")).toBe(true);
    expect(shouldAlert("CONFIG_DRIFT", "HIGH")).toBe(true);
    expect(shouldAlert("NEW_DEVICE", "HIGH")).toBe(true);
  });

  it("stays quiet for low severity or routine kinds", () => {
    expect(shouldAlert("BRAND_CHANGE", "MEDIUM")).toBe(false);
    expect(shouldAlert("INTEGRITY_OK", "CRITICAL")).toBe(false);
    expect(shouldAlert("LOGIN_FAILED", "INFO")).toBe(false);
  });
});

describe("recovery channels", () => {
  it("masks backup email local part", () => {
    expect(maskValue("BACKUP_EMAIL", "owner@taiznow.ye")).toBe("ow•••@taiznow.ye");
  });

  it("masks phone numbers keeping the last four digits", () => {
    expect(maskValue("PHONE", "+967 712 345 678")).toBe("•••• 5678");
  });

  it("labels every recovery kind", () => {
    for (const k of ["BACKUP_EMAIL", "PHONE", "TOTP"] as const) {
      expect(RECOVERY_KIND_LABELS[k]).toBeTruthy();
    }
  });
});

describe("security alert email", () => {
  it("exposes a mail sender without throwing on import", async () => {
    const mod = await import("@/lib/security/mail");
    expect(typeof mod.sendMail).toBe("function");
    expect(typeof mod.renderSecurityEmail).toBe("function");
  });
});

describe("owner-managed sections", () => {
  it("seeds the four default sections with unique slugs", async () => {
    const { DEFAULT_SECTIONS, SECTION_SLUG_RE } = await import("@/lib/platform/sections");
    const slugs = DEFAULT_SECTIONS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toEqual(["news", "rumors", "corrections", "maps"]);
    for (const s of DEFAULT_SECTIONS) expect(s.slug).toMatch(SECTION_SLUG_RE);
  });

  it("derives a latin slug from a latin title", async () => {
    const { slugFromTitle } = await import("@/lib/platform/sections");
    expect(slugFromTitle("Economy News")).toBe("economy-news");
  });

  it("falls back to a generated slug for a non-latin (Arabic) title", async () => {
    const { slugFromTitle, SECTION_SLUG_RE } = await import("@/lib/platform/sections");
    const slug = slugFromTitle("اقتصاد");
    expect(slug).toMatch(SECTION_SLUG_RE);
    expect(slug).toMatch(/^section-/);
  });
});
