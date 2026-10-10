import { listContent } from "@/lib/queries";
import { SectionView } from "@/components/SectionView";

export const dynamic = "force-dynamic";

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const items = await listContent({ kind: "NEWS", q, take: 40 });
  return (
    <SectionView
      title="الأخبار الموثقة"
      desc="أخبار تم التحقق منها ومراجعتها بمصادر وأدلة، مع درجة ثقة واضحة وتاريخ آخر مراجعة."
      base="/news"
      empty="لا توجد أخبار منشورة بعد."
      items={items}
      q={q}
    />
  );
}
