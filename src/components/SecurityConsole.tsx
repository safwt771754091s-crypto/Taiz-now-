"use client";

import { useCallback, useEffect, useState } from "react";

type Event = {
  id: string;
  kind: string;
  severity: string;
  title: string;
  detail: unknown;
  resolved: boolean;
  createdAt: string;
};

type Drift = { drifted: boolean; baselineHash: string | null; differences: string[] };

const SEV_STYLE: Record<string, string> = {
  INFO: "text-slate-300",
  LOW: "text-sky-300",
  MEDIUM: "text-amber-300",
  HIGH: "text-orange-300",
  CRITICAL: "text-rose-300",
};

const KIND_LABELS: Record<string, string> = {
  CONFIG_DRIFT: "انحراف إعدادات",
  BRAND_CHANGE: "تغيير الهوية",
  EMAIL_CHANGE: "تغيير البريد",
  PAGE_CHANGE: "تغيير صفحة",
  ROLE_CHANGE: "تغيير صلاحية",
  PASSWORD_CHANGE: "تغيير كلمة مرور",
  LOGIN_FAILED: "دخول فاشل",
  NEW_DEVICE: "جهاز جديد",
  CONNECTION_CHANGE: "تغيير قناة",
  INTEGRITY_OK: "سلامة سليمة",
  RECOVERY: "استعادة",
};

function fmt(dt: string) {
  return new Date(dt).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" });
}

export default function SecurityConsole() {
  const [events, setEvents] = useState<Event[]>([]);
  const [drift, setDrift] = useState<Drift | null>(null);
  const [baselines, setBaselines] = useState<{ hash: string; createdAt: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/security");
    const json = await res.json();
    if (res.ok) {
      setEvents(json.data.events);
      setDrift(json.data.drift);
      setBaselines(json.data.baselines);
    } else setErr(json.error ?? "تعذر التحميل");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: string, id?: string) {
    setBusy(action);
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(json.error ?? "فشل الإجراء");
    if (action === "scan") setMsg(json.data.drifted ? `رصد انحرافاً: ${json.data.differences.length} فرق.` : "السلامة سليمة — لا انحراف.");
    else if (action === "approve-baseline") setMsg("اعتُمد خط أساس جديد.");
    else if (action === "restore") setMsg(json.data.restored ? "استُعيدت الإعدادات المعتمدة." : "لا يوجد خط أساس معتمد.");
    else setMsg("تم التعليم كمُعالَج.");
    load();
  }

  return (
    <div className="space-y-6">
      {msg && <div className="card border-emerald-500/40 p-3 text-sm text-emerald-300">{msg}</div>}
      {err && <div className="card border-rose-500/40 p-3 text-sm text-rose-300">{err}</div>}

      <section className={`card p-5 ${drift?.drifted ? "border-amber-500/50" : "border-emerald-500/40"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">سلامة الإعدادات</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {drift?.drifted ? "⚠️ الإعدادات تغيّرت عن الخط المعتمد." : "✅ الإعدادات مطابقة للخط المعتمد."}
            </p>
            {drift?.baselineHash && (
              <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">baseline: {drift.baselineHash.slice(0, 16)}…</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="chip" disabled={busy === "scan"} onClick={() => act("scan")}>فحص الآن</button>
            <button className="chip" disabled={busy === "approve-baseline"} onClick={() => act("approve-baseline")}>اعتماد خط أساس</button>
            <button className="btn-primary rounded-lg px-3 py-1.5 text-sm font-bold" disabled={busy === "restore"} onClick={() => act("restore")}>
              استعادة المعتمد
            </button>
          </div>
        </div>
        {drift?.drifted && drift.differences.length > 0 && (
          <ul className="mt-3 list-inside list-disc text-xs text-amber-200">
            {drift.differences.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-black">سجل الأحداث الأمنية</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-right text-xs text-[var(--muted)]">
              <tr>
                <th className="py-2">الوقت</th>
                <th>النوع</th>
                <th>الخطورة</th>
                <th>التفصيل</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 text-xs text-[var(--muted)]">{fmt(e.createdAt)}</td>
                  <td>{KIND_LABELS[e.kind] ?? e.kind}</td>
                  <td className={`text-xs font-bold ${SEV_STYLE[e.severity] ?? ""}`}>{e.severity}</td>
                  <td className="max-w-xs text-xs">{e.title}</td>
                  <td className="text-xs">
                    {e.resolved ? (
                      <span className="text-emerald-300">مُعالَج</span>
                    ) : (
                      <button className="chip" onClick={() => act("resolve", e.id)}>تعليم كمُعالَج</button>
                    )}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-sm text-[var(--muted)]">لا أحداث بعد.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
