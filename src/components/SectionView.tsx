import { ContentList, type ContentCardItem } from "@/components/ContentList";

export function SectionView({
  title,
  desc,
  base,
  empty,
  items,
  q,
  kicker,
}: {
  title: string;
  desc: string;
  base: string;
  empty: string;
  items: ContentCardItem[];
  q?: string;
  kicker?: string;
}) {
  return (
    <div className="space-y-6">
      <header className="border-b-2 border-[var(--border-strong)] pb-5">
        {kicker && <span className="eyebrow block">{kicker}</span>}
        <h1 className="headline mt-1 text-3xl font-bold md:text-4xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{desc}</p>
        <form className="mt-4 flex max-w-md gap-2">
          <input name="q" defaultValue={q ?? ""} placeholder="ابحث بالعنوان أو الملخص..." />
          <button className="btn-primary px-5" type="submit">
            بحث
          </button>
        </form>
      </header>
      <ContentList items={items} hrefBase={base} emptyText={empty} />
    </div>
  );
}
