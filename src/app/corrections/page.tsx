import { listContent } from "@/lib/queries";
import { SectionView } from "@/components/SectionView";

export const dynamic = "force-dynamic";

export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const items = await listContent({ kind: "CORRECTION", q, take: 40 });
  return (
    <SectionView
      title="مركز التصحيحات"
      desc="تصحيحات شفافة لما نُشر سابقاً، مع توضيح ما تم تعديله ومصدر التصحيح."
      base="/corrections"
      empty="لا توجد تصحيحات منشورة بعد."
      items={items}
      q={q}
    />
  );
}
