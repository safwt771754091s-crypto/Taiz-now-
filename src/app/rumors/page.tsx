import { listContent } from "@/lib/queries";
import { SectionView } from "@/components/SectionView";

export const dynamic = "force-dynamic";

export default async function RumorsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const items = await listContent({ kind: "RUMOR", q, take: 40 });
  return (
    <SectionView
      title="مرصد الشائعات"
      desc="رصد وتحليل الشائعات المتداولة، وتحديد الادعاء ودرجة الخطورة والردّ المبني على الأدلة."
      base="/rumors"
      empty="لا توجد شائعات مرصودة بعد."
      items={items}
      q={q}
    />
  );
}
