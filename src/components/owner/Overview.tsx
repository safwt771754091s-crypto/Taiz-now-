"use client";

import { useEffect, useState } from "react";

type Overview = {
  content: { total: number; published: number; verified: number; drafts: number; inReview: number; byKind: Record<string, number> };
  reports: { total: number; pending: number; underReview: number };
  users: { total: number; byRole: Record<string, number> };
  sections: number;
  markers: number;
  sources: number;
  visits: { total: number; week: number; distinctWeek: number };
  security: { loginsWeek: number; failedLoginsWeek: number; auditWeek: number };
};

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-black">{value}</p>
      <p className="text-sm text-[var(--muted)]">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

/** Owner overview: the whole platform at a glance. */
export default function Overview() {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/stats");
      const json = await res.json();
      if (res.ok) setData(json.data);
      else setErr(json.error ?? "تعذر تحميل الإحصاءات");
    })();
  }, []);

  if (err) return <div className="card border-rose-500/40 p-3 text-sm text-rose-700">{err}</div>;
  if (!data) return <div className="card p-6 text-center text-sm text-[var(--muted)]">جارٍ التحميل…</div>;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="إجمالي المحتوى" value={data.content.total} hint={`${data.content.published} منشور`} />
        <Stat label="قيد المراجعة" value={data.content.inReview} hint={`${data.content.drafts} مسودة`} />
        <Stat label="بلاغات جديدة" value={data.reports.pending} hint={`${data.reports.total} إجمالي`} />
        <Stat label="زوار هذا الأسبوع" value={data.visits.week} hint={`${data.visits.distinctWeek} زائر مختلف`} />
        <Stat label="الأقسام" value={data.sections} />
        <Stat label="المستخدمون" value={data.users.total} />
        <Stat label="علامات الخريطة" value={data.markers} />
        <Stat label="المصادر" value={data.sources} />
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-lg font-black">توزيع المحتوى</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="eyebrow mb-2">حسب النوع</p>
            <ul className="space-y-2 text-sm">
              {Object.entries(data.content.byKind).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between">
                  <span>{k === "NEWS" ? "أخبار" : k === "RUMOR" ? "شائعات" : "تصحيحات"}</span>
                  <span className="font-bold">{v}</span>
                </li>
              ))}
              {Object.keys(data.content.byKind).length === 0 && (
                <li className="text-[var(--muted)]">لا يوجد محتوى بعد.</li>
              )}
            </ul>
          </div>
          <div>
            <p className="eyebrow mb-2">حالة الأمان (٧ أيام)</p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span>عمليات دخول ناجحة</span>
                <span className="font-bold">{data.security.loginsWeek}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>محاولات دخول فاشلة</span>
                <span className="font-bold text-rose-600">{data.security.failedLoginsWeek}</span>
              </li>
              <li className="flex items-center justify-between">
                <span>عمليات مسجّلة في سجل التدقيق</span>
                <span className="font-bold">{data.security.auditWeek}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
