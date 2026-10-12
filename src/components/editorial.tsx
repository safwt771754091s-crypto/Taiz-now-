import Link from "next/link";
import { VerdictBadge, ConfidenceBar } from "@/components/ui";
import { formatDate } from "@/lib/labels";
import type { Verdict } from "@prisma/client";

export type Item = {
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

/** Rolling headline strip under the masthead. */
export function Ticker({ items }: { items: { slug: string; title: string }[] }) {
  if (items.length === 0) return null;
  const row = (
    <>
      {items.map((i) => (
        <Link key={i.slug} href={`/news/${i.slug}`} className="mx-5 hover:underline">
          {i.title}
        </Link>
      ))}
    </>
  );
  return (
    <div className="flex items-center overflow-hidden rounded-md border border-[var(--border-strong)] bg-[var(--panel)]">
      <span className="kicker shrink-0 self-stretch rounded-none px-3 py-2">عاجل</span>
      <div className="relative flex-1 overflow-hidden py-2">
        <div className="ticker-track">
          {row}
          {row}
        </div>
      </div>
    </div>
  );
}

/** Large lead story. */
export function LeadStory({ item }: { item: Item }) {
  return (
    <article className="card overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--panel-2)] px-5 py-3">
        <span className="eyebrow">الخبر الرئيسي</span>
      </div>
      <div className="p-5 md:p-7">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={item.verdict} />
          {item.location && <span className="chip">📍 {item.location}</span>}
          <span className="text-xs text-[var(--muted)]">{formatDate(item.publishedAt)}</span>
        </div>
        <Link href={`/news/${item.slug}`}>
          <h2 className="prose-title text-2xl font-bold leading-snug transition md:text-4xl">
            {item.title}
          </h2>
        </Link>
        <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{item.summary}</p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <ConfidenceBar total={item.confidence} />
          <Link href={`/news/${item.slug}`} className="text-sm font-bold link">
            اقرأ الخبر كاملاً ←
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Standard article card. */
export function NewsCard({ item, base = "/news" }: { item: Item; base?: string }) {
  return (
    <Link
      href={`${base}/${item.slug}`}
      className="card group block p-4 transition hover:border-[var(--brand)]"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <VerdictBadge verdict={item.verdict} />
        <span className="text-xs text-[var(--muted)]">{formatDate(item.publishedAt)}</span>
      </div>
      <h3 className="prose-title mb-1 text-lg font-bold leading-snug transition">{item.title}</h3>
      <p className="line-clamp-3 text-sm leading-relaxed text-[var(--muted)]">{item.summary}</p>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
        <ConfidenceBar total={item.confidence} />
        {item.location && <span className="text-xs text-[var(--muted)]">📍 {item.location}</span>}
      </div>
    </Link>
  );
}

/** Compact numbered headline row (for side rails). */
export function HeadlineRow({
  item,
  index,
  base = "/news",
}: {
  item: Item;
  index: number;
  base?: string;
}) {
  return (
    <li className="flex gap-3 border-b border-[var(--border)] py-3 last:border-0">
      <span className="headline text-2xl font-bold text-[var(--brand)]/40">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <Link href={`${base}/${item.slug}`} className="prose-title block font-bold leading-snug transition">
          {item.title}
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <VerdictBadge verdict={item.verdict} />
          <span className="text-xs text-[var(--muted)]">{formatDate(item.publishedAt)}</span>
        </div>
      </div>
    </li>
  );
}

/** Block heading with a coloured rule. */
export function RuleHeading({
  title,
  href,
  accent = "var(--brand)",
  kicker,
}: {
  title: string;
  href?: string;
  accent?: string;
  kicker?: string;
}) {
  return (
    <div className="mb-4">
      {kicker && <span className="eyebrow block">{kicker}</span>}
      <div className="mt-1 flex items-center justify-between gap-3 border-b-2 border-[var(--border-strong)] pb-2">
        <h2 className="flex items-center gap-2 text-xl font-bold md:text-2xl">
          <span className="inline-block h-5 w-1.5 rounded-sm" style={{ background: accent }} />
          {title}
        </h2>
        {href && (
          <Link href={href} className="text-sm font-bold link">
            عرض الكل ←
          </Link>
        )}
      </div>
    </div>
  );
}
