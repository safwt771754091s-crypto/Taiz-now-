import Link from "next/link";
import { ConfidenceBar, Empty, VerdictBadge } from "@/components/ui";
import { formatDate } from "@/lib/labels";
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
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <Link
          key={item.id}
          href={`${hrefBase}/${item.slug}`}
          className="card block p-4 transition hover:border-brand/50"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <VerdictBadge verdict={item.verdict} />
            <span className="text-xs text-[var(--muted)]">{formatDate(item.publishedAt)}</span>
          </div>
          <h3 className="mb-1 font-bold">{item.title}</h3>
          <p className="line-clamp-2 text-sm text-[var(--muted)]">{item.summary}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <ConfidenceBar total={item.confidence} />
            {item.location && (
              <span className="text-xs text-[var(--muted)]">📍 {item.location}</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
