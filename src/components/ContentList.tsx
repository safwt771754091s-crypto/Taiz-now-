import { Empty } from "@/components/ui";
import { NewsCard, type Item } from "@/components/editorial";
import type { Verdict } from "@prisma/client";

export type ContentCardItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  verdict: Verdict;
  confidence: number;
  location: string | null;
  tags: string[];
  publishedAt: Date | null;
};

export function ContentList({
  items,
  hrefBase,
  emptyText,
}: {
  items: ContentCardItem[];
  hrefBase: string;
  emptyText: string;
}) {
  if (items.length === 0) {
    return (
      <div className="card">
        <Empty>{emptyText}</Empty>
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <NewsCard key={item.id} item={item as unknown as Item} base={hrefBase} />
      ))}
    </div>
  );
}

