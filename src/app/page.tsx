import Link from "next/link";
import { listContent, platformStats } from "@/lib/queries";
import { RuleHeading, LeadStory, NewsCard, HeadlineRow, Ticker, type Item } from "@/components/editorial";

export const dynamic = "force-dynamic";

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card-quiet px-3 py-4 text-center">
      <p className="headline text-2xl font-bold text-[var(--brand)]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[var(--muted)]">{label}</p>
    </div>
  );
}

export default async function Home() {
  // A database hiccup must not take the whole homepage down with a raw 500.
  // On failure we render the friendly empty state instead.
  let stats = { news: 0, rumors: 0, corrections: 0, reports: 0, verified: 0, markers: 0 };
  let news: Awaited<ReturnType<typeof listContent>> = [];
  let rumors: Awaited<ReturnType<typeof listContent>> = [];
  let corrections: Awaited<ReturnType<typeof listContent>> = [];
  try {
    [stats, news, rumors, corrections] = await Promise.all([
      platformStats(),
      listContent({ kind: "NEWS", take: 9 }),
      listContent({ kind: "RUMOR", take: 5 }),
      listContent({ kind: "CORRECTION", take: 4 }),
    ]);
  } catch (err) {
    console.error("[home] database unavailable, rendering empty state:", err);
  }

  const lead = news[0];
  const latestRumors = rumors as unknown as Item[];
  const latestCorrections = corrections as unknown as Item[];

  return (
    <div className="space-y-8">
      {news.length > 0 && <Ticker items={news.slice(0, 6)} />}

      {lead ? (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <LeadStory item={lead as unknown as Item} />
          <aside className="space-y-4">
            <RuleHeading title="الأكثر تداولًا" accent="var(--brand-2)" />
            {news.length > 1 ? (
              <ul className="card px-4 py-2">
                {news.slice(1, 6).map((item, i) => (
                  <HeadlineRow key={item.id} item={item as unknown as Item} index={i} />
                ))}
              </ul>
            ) : (
              <p className="card p-4 text-sm text-[var(--muted)]">لا توجد أخبار أخرى بعد.</p>
            )}
          </aside>
        </section>
      ) : (
        <section className="card p-10 text-center">
          <h1 className="text-2xl font-bold">لا ننشر ما يُقال... بل نتحقق مما حدث.</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            لا توجد أخبار منشورة بعد. أرسل بلاغًا أو انتظر أول خبر موثّق.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/reports/new" className="btn-primary px-5 py-2.5">
              أرسل بلاغًا
            </Link>
            <Link href="/login" className="btn-ghost px-5 py-2.5">
              دخول الفريق
            </Link>
          </div>
        </section>
      )}

      {/* Verification snapshot */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatCard label="أخبار موثقة" value={stats.news} />
        <StatCard label="شائعات مرصودة" value={stats.rumors} />
        <StatCard label="تصحيحات" value={stats.corrections} />
        <StatCard label="بلاغات" value={stats.reports} />
        <StatCard label="موثّق بالكامل" value={stats.verified} />
        <StatCard label="مواقع على الخريطة" value={stats.markers} />
      </section>

      {news.length > 1 && (
        <section>
          <RuleHeading title="أحدث الأخبار الموثقة" href="/news" kicker="تحقّقنا منها" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {news.slice(1).map((item) => (
              <NewsCard key={item.id} item={item as unknown as Item} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <RuleHeading title="مرصد الشائعات" href="/rumors" accent="#a86500" kicker="نرصد ونفنّد" />
          {latestRumors.length === 0 ? (
            <p className="card p-4 text-sm text-[var(--muted)]">لا توجد شائعات مرصودة بعد.</p>
          ) : (
            <ul className="card px-4 py-2">
              {latestRumors.map((item, i) => (
                <HeadlineRow key={item.id} item={item} index={i} base="/rumors" />
              ))}
            </ul>
          )}
        </div>
        <div>
          <RuleHeading title="مركز التصحيحات" href="/corrections" accent="var(--brand-2)" kicker="شفافية كاملة" />
          {latestCorrections.length === 0 ? (
            <p className="card p-4 text-sm text-[var(--muted)]">لا توجد تصحيحات منشورة بعد.</p>
          ) : (
            <ul className="card px-4 py-2">
              {latestCorrections.map((item, i) => (
                <HeadlineRow key={item.id} item={item} index={i} base="/corrections" />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card p-6 md:p-8">
        <RuleHeading title="كيف نتحقق؟" kicker="منهجيتنا" />
        <ol className="grid gap-4 md:grid-cols-4">
          {[
            { t: "البلاغ والجمع", d: "نستقبل البلاغات والوسائط من الجمهور والمصادر." },
            { t: "تحليل آلي", d: "فحص الصور والفيديو والبيانات الوصفية وكشف التوليد بالذكاء الاصطناعي." },
            { t: "مراجعة بشرية", d: "مدققو الحقائق يعتمدون الأدلة ويمنحون درجة الثقة." },
            { t: "النشر والتصحيح", d: "نشر مدعوم بالأدلة، مع تحديث وتصحيح عند ورود معلومات جديدة." },
          ].map((s, i) => (
            <li key={s.t} className="card-quiet border-t-2 border-t-[var(--brand)] p-4">
              <span className="headline mb-1 block text-3xl font-bold text-[var(--brand)]/30">
                {i + 1}
              </span>
              <p className="font-bold">{s.t}</p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
