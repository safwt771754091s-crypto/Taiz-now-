import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getBrand } from "@/lib/platform/brand";
import { PAGE_KIND_LABELS, type PageKind } from "@/lib/platform/pages";

export const dynamic = "force-dynamic";

export default async function ManagedPageView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await prisma.managedPage.findUnique({ where: { slug } });
  if (!page || !page.published) notFound();

  const [brand, siblings] = await Promise.all([
    getBrand(),
    prisma.managedPage.findMany({ where: { published: true, slug: { not: slug } }, orderBy: { navOrder: "asc" }, take: 8 }),
  ]);

  return (
    <article className="space-y-6">
      <header className="card p-8">
        <span className="chip mb-3 inline-block">{PAGE_KIND_LABELS[page.kind as PageKind] ?? "صفحة"}</span>
        <h1 className="text-3xl font-black">{page.title}</h1>
        {page.description && <p className="mt-3 max-w-2xl text-[var(--muted)]">{page.description}</p>}
        {brand.website && (
          <p className="mt-4 text-sm">
            <a href={brand.website} dir="ltr" className="text-brand">
              {brand.website}
            </a>
          </p>
        )}
      </header>

      <section className="card p-6">
        <p className="text-sm leading-7 text-[var(--muted)]">
          هذه صفحة أنشئت عبر «الحارس» على مسار <span dir="ltr" className="font-mono text-brand">{page.route}</span>. المحتوى
          التحريري الكامل يُدار من لوحة التحكم، وتُراقَب سلامة الصفحة تلقائياً من مركز الأمن.
        </p>
        {page.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {page.tags.map((t) => (
              <span key={t} className="chip text-xs">{t}</span>
            ))}
          </div>
        )}
      </section>

      <nav className="card p-5">
        <h2 className="mb-3 text-sm font-black">صفحات أخرى</h2>
        <ul className="flex flex-wrap gap-2">
          {siblings.map((s) => (
            <li key={s.id}>
              <Link href={s.route} className="chip text-xs">{s.title}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
