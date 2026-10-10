import { ContentList, type ContentCardItem } from "@/components/ContentList";

export function SectionView({
  title,
  desc,
  base,
  empty,
  items,
  q,
}: {
  title: string;
  desc: string;
  base: string;
  empty: string;
  items: ContentCardItem[];
  q?: string;
}) {
  return (
    <div className="space-y-6">
      <header className="card p-6">
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">{desc}</p>
        <form className="mt-4 flex gap-2">
          <input name="q" defaultValue={q ?? ""} placeholder="ابحث بالعنوان أو الملخص..." />
          <button className="btn-primary rounded-xl px-5" type="submit">
            بحث
          </button>
        </form>
      </header>
      <ContentList items={items} hrefBase={base} emptyText={empty} />
    </div>
  );
}
