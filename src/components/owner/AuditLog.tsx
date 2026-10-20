"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDate } from "@/lib/labels";

type LogRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  actor: string;
  detail: unknown;
  createdAt: string;
};

const ACTION_LABELS: Record<string, string> = {
  "content.create": "إنشاء محتوى",
  "content.update": "تعديل محتوى",
  "content.delete": "حذف محتوى",
  "content.publish": "نشر محتوى",
  "content.retract": "سحب محتوى",
  "content.verify": "تحقق من محتوى",
  "content.polish": "تحسين صياغة",
  "report.create": "بلاغ جديد",
  "report.update": "تحديث بلاغ",
  "section.create": "إنشاء قسم",
  "section.update": "تعديل قسم",
  "section.delete": "حذف قسم",
  "user.create": "إنشاء مستخدم",
  "user.update": "تعديل مستخدم",
  "platform.brand.update": "تحديث الهوية",
  "platform.page.create": "إنشاء صفحة",
  "platform.page.update": "تعديل صفحة",
  "platform.page.delete": "حذف صفحة",
  "social.draft": "مسودة نشر اجتماعي",
};

/** Owner screen: the raw activity ledger, newest first. */
export default function AuditLog() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ take: "100" });
    if (q) params.set("q", q);
    const res = await fetch(`/api/admin/audit?${params.toString()}`);
    const json = await res.json();
    if (res.ok) setLogs(json.data.logs);
    else setErr(json.error ?? "تعذر تحميل السجل");
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black">سجل النشاط ({logs.length})</h2>
        <input
          className="text-sm"
          placeholder="تصفية حسب نوع العملية..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {err && <div className="mb-3 text-sm text-rose-700">{err}</div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-right text-xs text-[var(--muted)]">
            <tr>
              <th className="py-2">العملية</th>
              <th>المنفّذ</th>
              <th>الوقت</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="py-2">
                  <span className="font-bold">{ACTION_LABELS[l.action] ?? l.action}</span>
                  {l.entityType && (
                    <span className="ms-2 text-xs text-[var(--muted)]">{l.entityType}</span>
                  )}
                </td>
                <td className="text-xs">{l.actor}</td>
                <td className="text-xs text-[var(--muted)]">{formatDate(l.createdAt)}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-sm text-[var(--muted)]">
                  لا توجد عمليات مسجّلة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
