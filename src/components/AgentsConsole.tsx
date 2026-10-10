"use client";

import { useCallback, useEffect, useState } from "react";

type AgentRow = {
  id: string;
  slug: string;
  name: string;
  role: string;
  description: string;
  kind: string;
  kindLabel: string;
  status: "ENABLED" | "PAUSED" | "DISABLED";
  runCount: number;
  errorCount: number;
  lastRunAt: string | null;
  config: { capabilities?: string[] } | null;
  runs: { id: string; summary: string; status: string; createdAt: string }[];
};

type RecentRun = {
  id: string;
  summary: string;
  status: string;
  createdAt: string;
  agent: { name: string; slug: string };
};

const STATUS_LABELS: Record<string, string> = {
  ENABLED: "مفعّل",
  PAUSED: "متوقف مؤقتاً",
  DISABLED: "معطّل",
};

const STATUS_STYLE: Record<string, string> = {
  ENABLED: "text-emerald-300",
  PAUSED: "text-amber-300",
  DISABLED: "text-rose-300",
};

function fmt(dt: string | null) {
  if (!dt) return "لم يعمل بعد";
  return new Date(dt).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" });
}

export default function AgentsConsole() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [recent, setRecent] = useState<RecentRun[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/agents");
    const json = await res.json();
    if (res.ok) {
      setAgents(json.data.agents);
      setRecent(json.data.recentRuns);
    } else {
      setErr(json.error ?? "تعذر تحميل الوكلاء");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "run" | "enable" | "pause" | "disable") {
    setBusy(id);
    setMsg(null);
    setErr(null);
    const res = await fetch(`/api/agents/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (!res.ok) setErr(json.error ?? "تعذر تنفيذ الإجراء");
    else if (action === "run") setMsg(`الوكيل: ${json.data.summary}`);
    setBusy(null);
    load();
  }

  async function runAll() {
    setBusy("all");
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/agents/autopilot", { method: "POST" });
    const json = await res.json();
    if (!res.ok) setErr(json.error ?? "تعذر تشغيل الطيار الآلي");
    else setMsg(`شُغّل الطيار الآلي: ${json.data.ok}/${json.data.ran} وكلاء بنجاح.`);
    setBusy(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="text-lg font-bold">منظومة الوكلاء الأذكياء</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            الوكلاء يعملون على البيانات المخزّنة فقط: يرصدون، يدقّقون، يصوغون، ينشرون، ويفنّدون الشائعات.
          </p>
        </div>
        <button
          onClick={runAll}
          disabled={busy !== null}
          className="btn-primary rounded-xl px-6 py-2.5 disabled:opacity-50"
        >
          {busy === "all" ? "جارٍ التشغيل..." : "تشغيل الطيار الآلي الآن"}
        </button>
      </div>

      {msg && <p className="card p-3 text-sm text-emerald-300">{msg}</p>}
      {err && <p className="card p-3 text-sm text-rose-300">{err}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((a) => (
          <section key={a.id} className="card space-y-3 p-5">
            <header className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="chip border-brand/40 text-brand">{a.kindLabel}</span>
                  <h3 className="text-lg font-black">{a.name}</h3>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">{a.role}</p>
              </div>
              <span className={`text-sm font-bold ${STATUS_STYLE[a.status]}`}>{STATUS_LABELS[a.status]}</span>
            </header>

            <p className="text-sm text-[var(--muted)]">{a.description}</p>

            {a.config?.capabilities && (
              <ul className="space-y-1 text-xs text-[var(--muted)]">
                {a.config.capabilities.map((c) => (
                  <li key={c}>• {c}</li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)]">
              <span>عدد التشغيلات: {a.runCount}</span>
              <span>الأخطاء: {a.errorCount}</span>
              <span>آخر تشغيل: {fmt(a.lastRunAt)}</span>
            </div>

            {a.runs[0] && <p className="text-xs text-white/70">آخر نتيجة: {a.runs[0].summary}</p>}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => act(a.id, "run")}
                disabled={busy !== null}
                className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
              >
                تشغيل الآن
              </button>
              {a.status !== "ENABLED" && (
                <button onClick={() => act(a.id, "enable")} className="chip border-emerald-400/40 text-emerald-300">
                  تفعيل
                </button>
              )}
              {a.status === "ENABLED" && (
                <button onClick={() => act(a.id, "pause")} className="chip border-amber-400/40 text-amber-300">
                  إيقاف مؤقت
                </button>
              )}
              {a.status !== "DISABLED" && (
                <button onClick={() => act(a.id, "disable")} className="chip border-rose-400/40 text-rose-300">
                  تعطيل
                </button>
              )}
            </div>
          </section>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-bold">سجل النشاط الأخير</h2>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">لا يوجد نشاط بعد.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2">
                  <span className={`chip ${r.status === "ok" ? "text-emerald-300" : "text-rose-300"}`}>
                    {r.agent.name}
                  </span>
                  {r.summary}
                </span>
                <span className="text-xs text-[var(--muted)]">{fmt(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
