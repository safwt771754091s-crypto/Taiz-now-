import { prisma } from "@/lib/prisma";

/** Default sections seeded by the migration; mirrored here for safe upserts. */
export const DEFAULT_SECTIONS = [
  { slug: "news", title: "الأخبار الموثقة", titleEn: "News", icon: "📰", navOrder: 10, description: "أخبار تم التحقق منها بالأدلة والمصادر." },
  { slug: "rumors", title: "مرصد الشائعات", titleEn: "Rumor Watch", icon: "🔎", navOrder: 20, description: "رصد الشائعات المتداولة وتقييم صحتها." },
  { slug: "corrections", title: "مركز التصحيحات", titleEn: "Corrections", icon: "✍️", navOrder: 30, description: "تصحيحات شفافة لما نُشر سابقاً." },
  { slug: "maps", title: "الخرائط والتحقق الجغرافي", titleEn: "Maps", icon: "🗺️", navOrder: 40, description: "تحقق جغرافي وخرائط تفاعلية للأحداث." },
] as const;

export const SECTION_SLUG_RE = /^[a-z0-9-]{2,60}$/;

export type SectionInput = {
  title: string;
  slug?: string;
  titleEn?: string | null;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  navOrder?: number;
  published?: boolean;
};

export async function listSections(opts?: { onlyPublished?: boolean }) {
  return prisma.section.findMany({
    where: opts?.onlyPublished ? { published: true } : undefined,
    orderBy: [{ navOrder: "asc" }, { createdAt: "asc" }],
  });
}

/** Ensure the default sections exist (idempotent). */
export async function ensureDefaultSections(): Promise<number> {
  let count = 0;
  for (const s of DEFAULT_SECTIONS) {
    await prisma.section.upsert({
      where: { slug: s.slug },
      create: { ...s, system: true, published: true },
      update: { system: true },
    });
    count++;
  }
  return count;
}

export async function createSection(input: SectionInput) {
  const slug = (input.slug?.trim() || slugFromTitle(input.title)).toLowerCase();
  if (!SECTION_SLUG_RE.test(slug)) {
    throw new Error("المُعرّف (slug) يجب أن يكون أحرفاً إنجليزية صغيرة وأرقاماً وشرطات");
  }
  const exists = await prisma.section.findUnique({ where: { slug } });
  if (exists) throw new Error("يوجد قسم بهذا المُعرّف مسبقاً");
  return prisma.section.create({
    data: {
      slug,
      title: input.title.trim().slice(0, 120),
      titleEn: input.titleEn?.trim() || null,
      description: input.description?.trim() || null,
      icon: input.icon?.trim() || null,
      color: input.color || null,
      navOrder: input.navOrder ?? 100,
      published: input.published ?? true,
    },
  });
}

/** Latin slug for a possibly-Arabic title; falls back to a timestamped id. */
export function slugFromTitle(title: string): string {
  const latin = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 50);
  return latin.length >= 2 ? latin : `section-${Date.now().toString(36)}`;
}

export async function updateSection(id: string, input: Partial<SectionInput>) {
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 120);
  if (input.titleEn !== undefined) data.titleEn = input.titleEn?.trim() || null;
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.icon !== undefined) data.icon = input.icon?.trim() || null;
  if (input.color !== undefined) data.color = input.color || null;
  if (input.navOrder !== undefined) data.navOrder = input.navOrder;
  if (input.published !== undefined) data.published = input.published;
  return prisma.section.update({ where: { id }, data });
}

export async function deleteSection(id: string) {
  const section = await prisma.section.findUnique({ where: { id } });
  if (!section) throw new Error("القسم غير موجود");
  if (section.system) throw new Error("لا يمكن حذف قسم أساسي — يمكنك إخفاؤه بدلاً من ذلك");
  const used = await prisma.contentItem.count({ where: { sectionSlug: section.slug } });
  if (used > 0) throw new Error(`لا يمكن الحذف: يوجد ${used} عنصر مرتبط بهذا القسم`);
  await prisma.section.delete({ where: { id } });
}
