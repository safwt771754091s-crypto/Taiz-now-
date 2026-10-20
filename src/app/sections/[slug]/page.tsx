import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { listContent } from "@/lib/queries";
import { SectionView } from "@/components/SectionView";

export const dynamic = "force-dynamic";

export default async function OwnerSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { slug } = await params;
  const { q } = await searchParams;

  const section = await prisma.section.findUnique({ where: { slug } });
  if (!section || !section.published) notFound();

  const items = await listContent({ sectionSlug: slug, q, take: 60 });

  return (
    <SectionView
      title={section.icon ? `${section.icon} ${section.title}` : section.title}
      desc={section.description ?? `كل ما يتعلق بقسم ${section.title}.`}
      base="/news"
      empty="لا يوجد محتوى منشور في هذا القسم بعد."
      items={items}
      q={q}
      kicker="قسم"
    />
  );
}
