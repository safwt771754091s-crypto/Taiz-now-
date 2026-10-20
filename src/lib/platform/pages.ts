import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/security/events";

export type PageKind = "LANDING" | "SECTION" | "PLATFORM" | "CONTACT" | "LEGAL" | "OTHER";

export const PAGE_KIND_LABELS: Record<PageKind, string> = {
  LANDING: "رئيسية",
  SECTION: "قسم",
  PLATFORM: "منصة",
  CONTACT: "تواصل",
  LEGAL: "قانوني",
  OTHER: "أخرى",
};

/**
 * Routes that ship in code. The guardian registers them so they can be
 * navigated and health-checked. `systemRoute` pages are never deleted.
 */
export const SYSTEM_PAGES: { route: string; slug: string; title: string; kind: PageKind; navOrder: number }[] = [
  { route: "/", slug: "home", title: "الرئيسية", kind: "LANDING", navOrder: 0 },
  { route: "/news", slug: "news", title: "الأخبار الموثقة", kind: "SECTION", navOrder: 10 },
  { route: "/rumors", slug: "rumors", title: "مرصد الشائعات", kind: "SECTION", navOrder: 20 },
  { route: "/corrections", slug: "corrections", title: "مركز التصحيحات", kind: "SECTION", navOrder: 30 },
  { route: "/reports", slug: "reports", title: "البلاغات", kind: "SECTION", navOrder: 40 },
  { route: "/maps", slug: "maps", title: "الخرائط", kind: "SECTION", navOrder: 50 },
  { route: "/agents", slug: "agents", title: "الوكلاء الأذكياء", kind: "PLATFORM", navOrder: 60 },
  { route: "/social", slug: "social", title: "وسائل التواصل", kind: "PLATFORM", navOrder: 65 },
  { route: "/platform", slug: "platform", title: "هوية المنصة والبريد", kind: "PLATFORM", navOrder: 70 },
  { route: "/security", slug: "security", title: "مركز الأمن", kind: "PLATFORM", navOrder: 75 },
  { route: "/about", slug: "about", title: "عن المنصة", kind: "CONTACT", navOrder: 80 },
  { route: "/owner", slug: "owner", title: "لوحة المالك", kind: "PLATFORM", navOrder: 85 },
  { route: "/dashboard", slug: "dashboard", title: "لوحة التحكم", kind: "PLATFORM", navOrder: 90 },
  { route: "/login", slug: "login", title: "تسجيل الدخول", kind: "PLATFORM", navOrder: 95 },
];

/** Register every system page (idempotent). */
export async function ensureSystemPages(): Promise<number> {
  let count = 0;
  for (const p of SYSTEM_PAGES) {
    await prisma.managedPage.upsert({
      where: { route: p.route },
      create: {
        route: p.route,
        slug: p.slug,
        title: p.title,
        kind: p.kind,
        systemRoute: true,
        agentBuilt: false,
        published: true,
        navOrder: p.navOrder,
        lastChecked: new Date(),
      },
      update: { title: p.title, kind: p.kind, systemRoute: true, navOrder: p.navOrder },
    });
    count++;
  }
  return count;
}

export type CreatePageInput = {
  title: string;
  slug: string;
  kind?: PageKind;
  description?: string;
  navOrder?: number;
  icon?: string;
  tags?: string[];
};

const SLUG = /^[a-z0-9-]{2,60}$/;

/** Create an agent-built page record. Routes are namespaced under /p/. */
export async function createManagedPage(input: CreatePageInput, actorId: string | null, agentBuilt = true) {
  const slug = input.slug.trim().toLowerCase();
  if (!SLUG.test(slug)) throw new Error("المُعرّف (slug) يجب أن يكون أحرفاً إنجليزية صغيرة وأرقاماً وشرطات");
  const route = `/p/${slug}`;
  const existing = await prisma.managedPage.findFirst({ where: { OR: [{ slug }, { route }] } });
  if (existing) throw new Error("توجد صفحة بهذا المُعرّف مسبقاً");

  const page = await prisma.managedPage.create({
    data: {
      slug,
      route,
      title: input.title.trim().slice(0, 120),
      kind: input.kind ?? "OTHER",
      description: input.description?.slice(0, 300) ?? null,
      icon: input.icon ?? null,
      tags: input.tags ?? [],
      navOrder: input.navOrder ?? 100,
      agentBuilt,
      systemRoute: false,
      published: true,
      lastChecked: new Date(),
    },
  });

  await recordSecurityEvent({
    kind: "PAGE_CHANGE",
    severity: "INFO",
    title: `إنشاء صفحة جديدة: ${page.title}`,
    detail: { route: page.route, agentBuilt },
    actorId,
  });
  return page;
}

export async function listPages() {
  return prisma.managedPage.findMany({
    orderBy: [{ navOrder: "asc" }, { createdAt: "asc" }],
  });
}

/** Sync the set of pages against the code registry; flag drift/deletion. */
export async function checkPageIntegrity(actorId: string | null): Promise<{
  total: number;
  missingSystem: string[];
  drifted: string[];
}> {
  const missing: string[] = [];
  for (const p of SYSTEM_PAGES) {
    const row = await prisma.managedPage.findUnique({ where: { route: p.route } });
    if (!row) {
      missing.push(p.route);
    } else if (!row.systemRoute || !row.published || row.title !== p.title) {
      await prisma.managedPage.update({
        where: { route: p.route },
        data: { systemRoute: true, published: true, title: p.title, health: "ok", lastChecked: new Date() },
      });
      await recordSecurityEvent({
        kind: "PAGE_CHANGE",
        severity: "MEDIUM",
        title: `تصحيح صفحة نظام: ${p.title}`,
        detail: { route: p.route },
        actorId,
      });
    }
  }

  const drifted = await prisma.managedPage.findMany({ where: { health: { not: "ok" } } });
  // Refresh health for every page we know about.
  await prisma.managedPage.updateMany({ data: { health: "ok", lastChecked: new Date() } });

  const total = await prisma.managedPage.count();
  return { total, missingSystem: missing, drifted: drifted.map((d) => d.route) };
}
