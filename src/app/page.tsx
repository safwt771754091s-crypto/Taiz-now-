import Link from "next/link";
import { listContent, platformStats } from "@/lib/queries";
import { ConfidenceBar, Empty, VerdictBadge } from "@/components/ui";
import { formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-sm font-bold">{label}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export default async function Home() {
  const [stats, latest] = await Promise.all([
    platformStats(),
    listContent({ kind: "NEWS", take: 5 }),
  ]);

  return (
    <div className="space-y-8">
      <section className="card overflow-hidden p-6 md:p-10">
        <span className="chip border-brand/40 text-brand">منصة يمنية مستقلة</span>
        <h1 className="mt-4 text-3xl font-black leading-tight md:text-4xl">
          لا ننشر ما يُقال... بل نتحقق مما حدث.
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--muted)]">
          منصة تعز الآن تجمع الأخبار الموثقة، ترصد الشائعات، تكشف التضليل والصور المفبركة والفيديو
          المزيّف، وتنشر التصحيحات المدعومة بالأدلة — بمساعدة الذكاء الاصطناعي ومراجعة بشرية.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/news" className="btn-primary rounded-xl px-5 py-2.5">
            الأخبار الموثقة
          </Link>
          <Link href="/reports/new" className="rounded-xl border border-[var(--border)] px-5 py-2.5 hover:bg-white/5">
            أرسل بلاغاً
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatCard label="أخبار موثقة" value={stats.news} />
        <StatCard label="شائعات مرصودة" value={stats.rumors} />
        <StatCard label="تصحيحات" value={stats.corrections} />
        <StatCard label="بلاغات" value={stats.reports} />
        <StatCard label="موثّق بالكامل" value={stats.verified} />
        <StatCard label="مواقع على الخريطة" value={stats.markers} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">أحدث الأخبار الموثقة</h2>
          <Link href="/news" className="text-sm text-brand hover:underline">
            عرض الكل ←
          </Link>
        </div>
        {latest.length === 0 ? (
          <div className="card">
            <Empty>لا توجد أخبار منشورة بعد.</Empty>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {latest.map((item) => (
              <Link key={item.id} href={`/news/${item.slug}`} className="card block p-4 transition hover:border-brand/50">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <VerdictBadge verdict={item.verdict} />
                  <span className="text-xs text-[var(--muted)]">{formatDate(item.publishedAt)}</span>
                </div>
                <h3 className="mb-1 font-bold">{item.title}</h3>
                <p className="line-clamp-2 text-sm text-[var(--muted)]">{item.summary}</p>
                <div className="mt-3">
                  <ConfidenceBar total={item.confidence} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-xl font-bold">كيف نتحقق؟</h2>
        <ol className="grid gap-3 md:grid-cols-4">
          {[
            { t: "البلاغ والجمع", d: "نستقبل البلاغات والوسائط من الجمهور والمصادر." },
            { t: "تحليل آلي", d: "فحص الصور والفيديو والبيانات الوصفية وكشف التوليد بالذكاء الاصطناعي." },
            { t: "مراجعة بشرية", d: "مدققو الحقائق يعتمدون الأدلة ويمنحون درجة الثقة." },
            { t: "النشر والتصحيح", d: "نشر مدعوم بالأدلة، مع تحديث وتصحيح عند ورود معلومات جديدة." },
          ].map((s, i) => (
            <li key={s.t} className="rounded-xl border border-[var(--border)] p-4">
              <span className="mb-2 grid h-8 w-8 place-items-center rounded-lg bg-white/10 font-bold">
                {i + 1}
              </span>
              <p className="font-bold">{s.t}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
