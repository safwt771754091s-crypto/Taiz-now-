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

type Alert = {
  id: string;
  channel: string;
  recipient: string;
  subject: string;
  severity: string;
  status: string;
  error: string | null;
  createdAt: string;
};

type Recovery = {
  id: string;
  kind: string;
  kindLabel: string;
  label: string;
  masked: string;
  verified: boolean;
  primary: boolean;
};

type LoginRow = {
  id: string;
  email: string;
  ok: boolean;
  ip: string | null;
  createdAt: string;
};

const ALERT_STATUS: Record<string, string> = {
  PENDING: "بالانتظار",
  SENT: "أُرسل",
  FAILED: "فشل",
  SKIPPED: "محفوظ (لا SMTP)",
};

const CHANNEL_LABELS: Record<string, string> = { EMAIL: "بريد", WEBHOOK: "Webhook", INBOX: "صندوق" };

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
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recovery, setRecovery] = useState<Recovery[]>([]);
  const [logins, setLogins] = useState<LoginRow[]>([]);
  const [newKind, setNewKind] = useState("BACKUP_EMAIL");
  const [newValue, setNewValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/security");
    const json = await res.json();
    if (res.ok) {
      setEvents(json.data.events);
      setDrift(json.data.drift);
      setAlerts(json.data.alerts ?? []);
      setRecovery(json.data.recovery ?? []);
      setLogins(json.data.logins ?? []);
    } else setErr(json.error ?? "تعذر التحميل");
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
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
    else if (action === "dispatch-alerts") setMsg(`أُرسل ${json.data.sent} وفشل ${json.data.failed} وسُجّل ${json.data.skipped}.`);
    else if (action === "test-alert") {
      const ok = json.data.results?.every((r: { status: string }) => r.status === "SENT");
      setMsg(ok ? "أُرسل تنبيه اختبار بنجاح إلى كل قنوات الاسترجاع." : `لم يُرسل فعلياً (${json.data.transport === "inbox" ? "SMTP غير مهيأ" : "فشل الإرسال"}) — راجع سجل التنبيهات.`);
    }
    else setMsg("تم التنفيذ.");
    load();
  }

  async function addRecovery() {
    if (!newValue.trim()) return;
    setBusy("add-recovery");
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add-recovery", kind: newKind, value: newValue, primary: recovery.length === 0 }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) return setErr(json.error ?? "فشل الإضافة");
    setNewValue("");
    setMsg("أُضيفت قناة الاسترجاع.");
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
        <h2 className="mb-1 text-lg font-black">قنوات الاسترجاع</h2>
        <p className="mb-4 text-xs text-[var(--muted)]">
          بريد احتياطي أو رقم تُرسل إليه تنبيهات «الحارس» فور أي تغيير غير مصرّح به — لاستعادة السيطرة إذا تعذّر الدخول.
        </p>
        <ul className="mb-4 divide-y divide-[var(--border)]">
          {recovery.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-sm">
                <span className="chip me-2">{r.kindLabel}</span>
                <span dir="ltr" className="font-mono text-xs">{r.masked}</span>
                {r.primary && <span className="ms-2 text-xs text-brand">أساسية</span>}
              </span>
              <button className="chip text-xs" onClick={() => act("remove-recovery", r.id)}>حذف</button>
            </li>
          ))}
          {recovery.length === 0 && <li className="py-2 text-sm text-[var(--muted)]">لا قنوات استرجاع بعد.</li>}
        </ul>
        <div className="flex flex-wrap gap-2">
          <select className="w-40" value={newKind} onChange={(e) => setNewKind(e.target.value)}>
            <option value="BACKUP_EMAIL">بريد احتياطي</option>
            <option value="PHONE">رقم هاتف</option>
            <option value="TOTP">TOTP</option>
          </select>
          <input className="w-64" dir="ltr" placeholder="backup@example.com" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
          <button className="chip" disabled={busy === "add-recovery"} onClick={addRecovery}>إضافة قناة</button>
        </div>
      </section>

      <section className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black">تنبيهات الأمن</h2>
          <div className="flex gap-2">
            <button className="chip" disabled={busy === "test-alert"} onClick={() => act("test-alert")}>
              إرسال تنبيه اختبار
            </button>
            <button className="chip" disabled={busy === "dispatch-alerts"} onClick={() => act("dispatch-alerts")}>
              إرسال المعلّق الآن
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-right text-xs text-[var(--muted)]">
              <tr>
                <th className="py-2">الوقت</th>
                <th>القناة</th>
                <th>المستلم</th>
                <th>الخطورة</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td className="py-2 text-xs text-[var(--muted)]">{fmt(a.createdAt)}</td>
                  <td className="text-xs">{CHANNEL_LABELS[a.channel] ?? a.channel}</td>
                  <td dir="ltr" className="max-w-[12rem] truncate font-mono text-xs" title={a.recipient}>{a.recipient}</td>
                  <td className={`text-xs font-bold ${SEV_STYLE[a.severity] ?? ""}`}>{a.severity}</td>
                  <td className="text-xs" title={a.error ?? undefined}>{ALERT_STATUS[a.status] ?? a.status}</td>
                </tr>
              ))}
              {alerts.length === 0 && (
                <tr><td colSpan={5} className="py-3 text-center text-sm text-[var(--muted)]">لا تنبيهات.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-black">سجل الدخول (آخر 30)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-right text-xs text-[var(--muted)]">
              <tr>
                <th className="py-2">الوقت</th>
                <th>الحساب</th>
                <th>IP</th>
                <th>النتيجة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {logins.map((l) => (
                <tr key={l.id}>
                  <td className="py-2 text-xs text-[var(--muted)]">{fmt(l.createdAt)}</td>
                  <td dir="ltr" className="text-xs">{l.email}</td>
                  <td dir="ltr" className="font-mono text-xs">{l.ip ?? "—"}</td>
                  <td className="text-xs">{l.ok ? <span className="text-emerald-300">ناجح</span> : <span className="text-rose-300">فاشل</span>}</td>
                </tr>
              ))}
              {logins.length === 0 && (
                <tr><td colSpan={4} className="py-3 text-center text-sm text-[var(--muted)]">لا سجل بعد.</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
