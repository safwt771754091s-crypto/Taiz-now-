import ContentDetail from "@/components/ContentDetail";

export const dynamic = "force-dynamic";

export default async function RumorDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ContentDetail slug={slug} />;
}
