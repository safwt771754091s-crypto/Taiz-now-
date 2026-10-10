import type { CSSProperties } from "react";
import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/security/events";

export type Brand = {
  name: string;
  nameEn: string;
  tagline: string;
  slogan: string;
  primary: string;
  accent: string;
  website: string | null;
};

export const DEFAULT_BRAND: Brand = {
  name: "تعز الآن",
  nameEn: "Taiz Now",
  tagline: "منصة التحقق الذكي",
  slogan: "لا ننشر ما يُقال... بل نتحقق مما حدث.",
  primary: "#2dd4bf",
  accent: "#38bdf8",
  website: null,
};

/** Read the platform brand, falling back to defaults when unset. */
export async function getBrand(): Promise<Brand> {
  const row = await prisma.platformBrand.findUnique({ where: { id: "main" } });
  if (!row) return DEFAULT_BRAND;
  return {
    name: row.name,
    nameEn: row.nameEn,
    tagline: row.tagline,
    slogan: row.slogan,
    primary: row.primary,
    accent: row.accent,
    website: row.website,
  };
}

/** Inline style that applies the brand colours to a subtree. */
export function brandStyle(b: Brand): CSSProperties {
  return {
    ["--brand" as never]: b.primary,
    ["--brand-2" as never]: b.accent,
  } as CSSProperties;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function updateBrand(input: Partial<Brand>, actorId: string | null): Promise<Brand> {
  const current = await getBrand();
  const next: Brand = {
    name: input.name?.trim() || current.name,
    nameEn: input.nameEn?.trim() || current.nameEn,
    tagline: input.tagline?.trim() || current.tagline,
    slogan: input.slogan?.trim() || current.slogan,
    primary: HEX.test(input.primary ?? "") ? input.primary! : current.primary,
    accent: HEX.test(input.accent ?? "") ? input.accent! : current.accent,
    website: input.website === undefined ? current.website : input.website?.trim() || null,
  };

  await prisma.platformBrand.upsert({
    where: { id: "main" },
    create: { id: "main", ...next },
    update: { ...next },
  });

  // Brand changes are a hijack signal: an attacker often rewrites the masthead.
  const changed = (["name", "nameEn", "slogan", "primary"] as const).filter((k) => current[k] !== next[k]);
  if (changed.length) {
    await recordSecurityEvent({
      kind: "BRAND_CHANGE",
      severity: "HIGH",
      title: `تغيير هوية المنصة (${changed.join(", ")})`,
      detail: { before: current, after: next, changed },
      actorId,
    });
  }
  return next;
}
