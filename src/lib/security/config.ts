import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getBrand } from "@/lib/platform/brand";
import { recordSecurityEvent } from "@/lib/security/events";

export type PlatformConfigPayload = {
  brand: Record<string, unknown>;
  emails: string[];
  pages: { route: string; title: string; published: boolean }[];
  connections: { provider: string; mode: string; enabled: boolean; handle: string | null }[];
};

/** Assemble the exact settings that define the platform's identity. */
export async function collectPlatformConfig(): Promise<PlatformConfigPayload> {
  const [brand, emails, pages, connections] = await Promise.all([
    getBrand(),
    prisma.platformEmailAccount.findMany({ orderBy: { address: "asc" } }),
    prisma.managedPage.findMany({ orderBy: { route: "asc" } }),
    prisma.socialConnection.findMany({ orderBy: { provider: "asc" } }),
  ]);
  return {
    brand: { ...brand },
    emails: emails.map((e) => e.address),
    pages: pages.map((p) => ({ route: p.route, title: p.title, published: p.published })),
    connections: connections.map((c) => ({
      provider: c.provider,
      mode: c.mode,
      enabled: c.enabled,
      handle: c.handle,
    })),
  };
}

/** Deterministic hash of a config payload (key order is irrelevant). */
export function configHash(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Approve the current configuration as the trusted baseline. */
export async function approveBaseline(actorId: string): Promise<{ hash: string }> {
  const payload = await collectPlatformConfig();
  const hash = configHash(payload);
  await prisma.configSnapshot.create({
    data: { scope: "platform", hash, payload: payload as never, approved: true, approvedBy: actorId },
  });
  await recordSecurityEvent({
    kind: "INTEGRITY_OK",
    severity: "INFO",
    title: "اعتماد خط أساس جديد للإعدادات",
    detail: { hash },
    actorId,
  });
  return { hash };
}

export type DriftResult = {
  hash: string;
  baselineHash: string | null;
  drifted: boolean;
  differences: string[];
};

const FIELD_LABELS: Record<string, string> = {
  "brand.name": "اسم المنصة",
  "brand.slogan": "شعار المنصة",
  "brand.primary": "اللون الأساسي",
  "brand.website": "الموقع",
  emails: "بُرد المنصة",
  pages: "الصفحات",
  connections: "قنوات التواصل",
};

/** Compare live config to the latest approved baseline. */
export async function detectDrift(): Promise<DriftResult> {
  const payload = await collectPlatformConfig();
  const hash = configHash(payload);
  const baseline = await prisma.configSnapshot.findFirst({
    where: { scope: "platform", approved: true },
    orderBy: { createdAt: "desc" },
  });
  if (!baseline) return { hash, baselineHash: null, drifted: false, differences: [] };

  const before = baseline.payload as unknown as PlatformConfigPayload;
  const differences: string[] = [];

  for (const key of ["name", "slogan", "primary", "website"] as const) {
    if ((before.brand?.[key] ?? null) !== (payload.brand?.[key] ?? null)) {
      differences.push(`${FIELD_LABELS[`brand.${key}`]} تغيّر من «${before.brand?.[key] ?? "-"}» إلى «${payload.brand?.[key] ?? "-"}»`);
    }
  }
  const beforeEmails = new Set(before.emails ?? []);
  const nowEmails = new Set(payload.emails);
  for (const e of nowEmails) if (!beforeEmails.has(e)) differences.push(`بريد مضاف: ${e}`);
  for (const e of beforeEmails) if (!nowEmails.has(e)) differences.push(`بريد محذوف: ${e}`);

  const beforePages = new Map((before.pages ?? []).map((p) => [p.route, p]));
  const nowPages = new Map(payload.pages.map((p) => [p.route, p]));
  for (const [route, p] of nowPages) {
    const prev = beforePages.get(route);
    if (!prev) differences.push(`صفحة مضافة: ${route}`);
    else if (prev.title !== p.title) differences.push(`عنوان صفحة تغيّر: ${route}`);
    else if (prev.published && !p.published) differences.push(`صفحة أُخفيَت: ${route}`);
  }
  for (const route of beforePages.keys()) if (!nowPages.has(route)) differences.push(`صفحة محذوفة: ${route}`);

  const beforeConn = new Map((before.connections ?? []).map((c) => [c.provider, c]));
  for (const c of payload.connections) {
    const prev = beforeConn.get(c.provider);
    if (prev && (prev.enabled !== c.enabled || prev.mode !== c.mode)) {
      differences.push(`قناة ${c.provider} تغيّرت (${prev.mode}→${c.mode})`);
    }
  }

  const drifted = hash !== baseline.hash;
  return { hash, baselineHash: baseline.hash, drifted, differences };
}

/** Run a scan, record a drift event, and return the report. */
export async function runIntegrityScan(actorId: string | null): Promise<DriftResult> {
  const result = await detectDrift();
  if (result.drifted) {
    await recordSecurityEvent({
      kind: "CONFIG_DRIFT",
      severity: "HIGH",
      title: "انحراف في إعدادات المنصة عن الخط المعتمد",
      detail: result,
      actorId,
    });
  } else {
    await recordSecurityEvent({
      kind: "INTEGRITY_OK",
      severity: "INFO",
      title: "فحص سلامة الإعدادات: سليم",
      detail: { hash: result.hash },
      actorId,
    });
  }
  return result;
}

/** Restore the platform settings to the latest approved baseline. */
export async function restoreBaseline(actorId: string): Promise<{ restored: boolean; from?: string }> {
  const baseline = await prisma.configSnapshot.findFirst({
    where: { scope: "platform", approved: true },
    orderBy: { createdAt: "desc" },
  });
  if (!baseline) return { restored: false };
  const payload = baseline.payload as unknown as PlatformConfigPayload;
  const b = payload.brand as Partial<Record<string, string | null>>;
  const brandData = {
    name: (b.name as string) ?? "تعز الآن",
    nameEn: (b.nameEn as string) ?? "Taiz Now",
    tagline: (b.tagline as string) ?? "منصة التحقق الذكي",
    slogan: (b.slogan as string) ?? "لا ننشر ما يُقال... بل نتحقق مما حدث.",
    primary: (b.primary as string) ?? "#2dd4bf",
    accent: (b.accent as string) ?? "#38bdf8",
    website: (b.website as string | null) ?? null,
  };

  await prisma.platformBrand.upsert({
    where: { id: "main" },
    create: { id: "main", ...brandData },
    update: brandData,
  });

  // Re-register the approved mailboxes and unpublish anything added since.
  for (const address of payload.emails) {
    await prisma.platformEmailAccount.upsert({ where: { address }, create: { address, displayName: "منصة" }, update: {} });
  }

  const approvedRoutes = new Set(payload.pages.map((p) => p.route));
  const pages = await prisma.managedPage.findMany();
  for (const p of pages) {
    const approved = approvedRoutes.has(p.route);
    const prev = payload.pages.find((x) => x.route === p.route);
    await prisma.managedPage.update({
      where: { id: p.id },
      data: {
        published: approved ? (prev?.published ?? true) : false,
        title: prev?.title ?? p.title,
      },
    });
  }
  for (const p of payload.pages) {
    if (!pages.some((x) => x.route === p.route)) {
      await prisma.managedPage.create({
        data: { route: p.route, slug: p.route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "page", title: p.title },
      });
    }
  }

  await recordSecurityEvent({
    kind: "RECOVERY",
    severity: "HIGH",
    title: "استعادة إعدادات المنصة من الخط المعتمد",
    detail: { from: baseline.hash, before: await collectPlatformConfig() },
    actorId,
  });
  return { restored: true, from: baseline.hash };
}
