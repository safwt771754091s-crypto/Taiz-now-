"use client";

import { useCallback, useEffect, useState } from "react";
import { REPORT_STATUS_LABELS, REPORT_TYPE_LABELS, formatDate } from "@/lib/labels";

type ReportRow = {
  id: string;
  type: keyof typeof REPORT_TYPE_LABELS;
  title: string;
  description: string;
  status: keyof typeof REPORT_STATUS_LABELS;
  priority: number;
  location: string | null;
  anonymous: boolean;
  reporterName: string | null;
  reporterContact: string | null;
  createdAt: string;
  assignedTo: { name: string } | null;
};

/** Owner screen: triage incoming reports — set status, priority and assignment. */
export default function ReportsManager() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [status, setStatus] = useState("ALL");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    const res = await fetch(`/api/reports?${params.toString()}`);
    const json = await res.json();
    if (res.ok) setRows(json.data);
    else setErr(json.error ?? "تعذر تحميل البلاغات");
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setErr(null);
    const res = await fetch(`/api/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setErr(json.error ?? "تعذر التحديث");
      return;
    }
    setMsg("تم تحديث البلاغ.");
    void load();
  }

  return (
    <div className="space-y-6">
      {msg && <div className="card border-emerald-500/40 p-3 text-sm text-emerald-700">{msg}</div>}
      {err && <div className="card border-rose-500/40 p-3 text-sm text-rose-700">{err}</div>}

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black">البلاغات الواردة ({rows.length})</h2>
          <select className="text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ALL">كل الحالات</option>
            {Object.entries(REPORT_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {rows.map((r) => (
            <li key={r.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button
                  className="text-start"
                  onClick={() => setOpen(open === r.id ? null : r.id)}
                >
                  <span className="flex items-center gap-2">
                    <span className="chip text-[10px]">{REPORT_TYPE_LABELS[r.type]}</span>
                    <span className="font-bold">{r.title}</span>
                    {r.priority > 0 && <span className="chip text-[10px]">أولوية {r.priority}</span>}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    {formatDate(r.createdAt)} · {r.anonymous ? "مجهول" : r.reporterName ?? "—"}
                    {r.location ? ` · ${r.location}` : ""}
                  </span>
                </button>
                <div className="flex flex-wrap gap-1">
                  <select
                    className="text-xs"
                    value={r.status}
                    disabled={busy === r.id}
                    onChange={(e) => patch(r.id, { status: e.target.value })}
                  >
                    {Object.entries(REPORT_STATUS_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                  <button
                    className="chip text-xs"
                    disabled={busy === r.id}
                    onClick={() => patch(r.id, { priority: r.priority > 0 ? 0 : 5 })}
                  >
                    {r.priority > 0 ? "إزالة الأولوية" : "أولوية عالية"}
                  </button>
                </div>
              </div>
              {open === r.id && (
                <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 text-sm">
                  <p className="leading-7">{r.description}</p>
                  {r.reporterContact && (
                    <p className="mt-2 text-xs text-[var(--muted)]" dir="ltr">
                      {r.reporterContact}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
          {rows.length === 0 && (
            <li className="py-6 text-center text-sm text-[var(--muted)]">لا توجد بلاغات مطابقة.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
