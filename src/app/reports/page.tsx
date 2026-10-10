import Link from "next/link";
import { REPORT_TYPE_LABELS } from "@/lib/labels";

export default function ReportsLanding() {
  return (
    <div className="space-y-6">
      <header className="card p-6">
        <h1 className="text-2xl font-black">نظام البلاغات</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          ساعدنا في مكافحة التضليل. أرسل خبراً مشكوكاً فيه، صورة، مقطع فيديو، أو رسالة متداولة —
          ويمكنك الإرسال بشكل مجهول تماماً. كل بلاغ يخضع لمراجعة فريق التحقق.
        </p>
        <Link href="/reports/new" className="btn-primary mt-4 inline-block rounded-xl px-5 py-2.5">
          إرسال بلاغ جديد
        </Link>
      </header>

      <section className="grid gap-3 md:grid-cols-5">
        {Object.entries(REPORT_TYPE_LABELS).map(([key, label]) => (
          <div key={key} className="card p-4 text-center">
            <p className="text-lg font-bold">{label}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">يمكن الإبلاغ عنه والتحقق منه</p>
          </div>
        ))}
      </section>

      <section className="card p-6">
        <h2 className="mb-4 text-lg font-bold">خطوات معالجة البلاغ</h2>
        <ol className="grid gap-3 md:grid-cols-5">
          {["استلام البلاغ", "فرز وتصنيف", "جمع الأدلة", "تحليل آلي وبشري", "نشر النتيجة أو التصحيح"].map(
            (s, i) => (
              <li key={s} className="rounded-xl border border-[var(--border)] p-4">
                <span className="mb-2 grid h-8 w-8 place-items-center rounded-lg bg-white/10 font-bold">
                  {i + 1}
                </span>
                <p className="text-sm font-bold">{s}</p>
              </li>
            ),
          )}
        </ol>
      </section>
    </div>
  );
}
