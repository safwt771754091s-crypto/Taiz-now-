import Link from "next/link";
import { notFound } from "next/navigation";
import { getContentBySlug } from "@/lib/queries";
import { ConfidenceBar, VerdictBadge } from "@/components/ui";
import { CONTENT_KIND_LABELS, VERDICT_LABELS, formatDate } from "@/lib/labels";
import { CONFIDENCE_WEIGHTS } from "@/lib/confidence";

const EVIDENCE_LABELS: Record<string, string> = {
  SOURCE: "مصدر",
  DOCUMENT: "وثيقة",
  IMAGE: "صورة",
  VIDEO: "فيديو",
  GEO: "دليل جغرافي",
  EXPERT: "رأي خبير",
};

export default async function ContentDetail({ slug }: { slug: string }) {
  const item = await getContentBySlug(slug);
  if (!item) notFound();

  const latestScore = item.scores[0] ?? null;
  const components = (
    latestScore
      ? [
          { key: "المصدر", value: latestScore.sourceScore, weight: CONFIDENCE_WEIGHTS.source },
          { key: "المحتوى", value: latestScore.contentScore, weight: CONFIDENCE_WEIGHTS.content },
          { key: "الصور", value: latestScore.imageScore, weight: CONFIDENCE_WEIGHTS.image },
          { key: "الفيديو", value: latestScore.videoScore, weight: CONFIDENCE_WEIGHTS.video },
          { key: "السياق", value: latestScore.contextScore, weight: CONFIDENCE_WEIGHTS.context },
          { key: "التدقيق البشري", value: latestScore.humanScore, weight: CONFIDENCE_WEIGHTS.human },
        ]
      : []
  );

  return (
    <article className="space-y-6">
      <nav className="text-sm text-[var(--muted)]">
        <Link href="/" className="hover:text-white">
          الرئيسية
        </Link>{" "}
        / <span className="text-white/80">{CONTENT_KIND_LABELS[item.kind]}</span>
      </nav>

      <header className="card p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={item.verdict} confidence={item.confidence} />
          <span className="chip">{CONTENT_KIND_LABELS[item.kind]}</span>
          {item.location && <span className="chip">📍 {item.location}</span>}
        </div>
        <h1 className="text-2xl font-black leading-snug md:text-3xl">{item.title}</h1>
        <p className="mt-3 text-[var(--muted)]">{item.summary}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[var(--muted)]">
          <span>آخر مراجعة: {formatDate(item.lastReviewedAt)}</span>
          <span>النشر: {formatDate(item.publishedAt)}</span>
          {item.reviewedBy?.name && <span>راجعه: {item.reviewedBy.name}</span>}
        </div>
        {item.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {item.tags.map((t) => (
              <span key={t} className="chip text-[var(--muted)]">
                #{t}
              </span>
            ))}
          </div>
        )}
      </header>

      {item.claim && (
        <section className="card border-r-4 border-r-amber-500/60 p-5">
          <h2 className="mb-2 text-sm font-bold text-amber-300">الادعاء المتداول</h2>
          <p className="text-sm leading-relaxed">{item.claim}</p>
        </section>
      )}

      {item.correctionNote && (
        <section className="card border-r-4 border-r-sky-500/60 p-5">
          <h2 className="mb-2 text-sm font-bold text-sky-300">ما تم تصحيحه</h2>
          <p className="text-sm leading-relaxed">{item.correctionNote}</p>
        </section>
      )}

      <section className="card p-6">
        <h2 className="mb-3 text-lg font-bold">التفاصيل والتحليل</h2>
        <div className="whitespace-pre-wrap text-sm leading-loose">{item.body}</div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold">درجة الثقة</h2>
          <ConfidenceBar total={item.confidence} />
          <p className="mt-3 text-sm text-[var(--muted)]">
            التقييم الحالي: <span className="font-bold text-white">{VERDICT_LABELS[item.verdict]}</span>
          </p>
          {components.length > 0 && (
            <ul className="mt-4 space-y-2">
              {components.map((c) => (
                <li key={c.key} className="text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <span>
                      {c.key} <span className="text-xs text-[var(--muted)]">({c.weight}%)</span>
                    </span>
                    <span className="font-bold">{c.value}/100</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-gradient-to-l from-teal-400 to-sky-500" style={{ width: `${c.value}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-4 text-lg font-bold">الأدلة والمصادر</h2>
          {item.evidence.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">لا توجد أدلة مسجلة.</p>
          ) : (
            <ul className="space-y-3">
              {item.evidence.map((e) => (
                <li key={e.id} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="chip text-[var(--muted)]">{EVIDENCE_LABELS[e.type] ?? e.type}</span>
                    {e.source?.name && <span className="text-xs text-[var(--muted)]">{e.source.name}</span>}
                  </div>
                  <p className="mt-2 text-sm font-bold">{e.title}</p>
                  {e.note && <p className="mt-1 text-xs text-[var(--muted)]">{e.note}</p>}
                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-1 inline-block text-xs text-brand hover:underline"
                    >
                      المصدر ↗
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {item.media.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-4 text-lg font-bold">تحليل الوسائط</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {item.media.map((m) => (
              <div key={m.id} className="rounded-xl border border-[var(--border)] p-3 text-sm">
                <p className="font-bold">{m.kind === "VIDEO" ? "فيديو" : m.kind === "IMAGE" ? "صورة" : "رسالة"}</p>
                {typeof m.aiGeneratedProbability === "number" && (
                  <p className="text-xs text-[var(--muted)]">
                    احتمال التوليد بالذكاء الاصطناعي: {Math.round(m.aiGeneratedProbability * 100)}%
                  </p>
                )}
                {typeof m.deepfakeProbability === "number" && (
                  <p className="text-xs text-[var(--muted)]">
                    احتمال التزييف العميق: {Math.round(m.deepfakeProbability * 100)}%
                  </p>
                )}
                <p className="mt-1 text-xs text-[var(--muted)]">
                  التحقق الجغرافي: {m.geoVerified ? "مؤكد" : "غير مؤكد"}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card p-5 text-sm text-[var(--muted)]">
        <p>
          منهجيتنا: لا ننشر ما يُقال بل نتحقق مما حدث. تعتمد درجات الثقة على المصدر والمحتوى وتحليل
          الوسائط والسياق والمراجعة البشرية، وتُحدَّث عند ورود معلومات جديدة.
        </p>
      </section>
    </article>
  );
}
