"use client";

import { useCallback, useEffect, useState } from "react";
import type { Section } from "@prisma/client";
import {
  CONTENT_KIND_LABELS,
  CONTENT_STATUS_LABELS,
  VERDICT_LABELS,
} from "@/lib/labels";

type ContentRow = {
  id: string;
  kind: "NEWS" | "RUMOR" | "CORRECTION";
  slug: string;
  title: string;
  summary: string;
  status: keyof typeof CONTENT_STATUS_LABELS;
  verdict: keyof typeof VERDICT_LABELS;
  confidence: number;
  sectionSlug: string | null;
  updatedAt: string;
};

type Draft = {
  id?: string;
  kind: "NEWS" | "RUMOR" | "CORRECTION";
  title: string;
  summary: string;
  body: string;
  sectionSlug: string;
};

const EMPTY: Draft = { kind: "NEWS", title: "", summary: "", body: "", sectionSlug: "" };

/** Owner screen: full editorial control over news, rumors and corrections. */
export default function ContentManager() {
  const [rows, setRows] = useState<ContentRow[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [filter, setFilter] = useState({ kind: "ALL", status: "ALL", q: "" });
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status: filter.status, kind: filter.kind, take: "100" });
    if (filter.q) params.set("q", filter.q);
    const [cRes, sRes] = await Promise.all([
      fetch(`/api/content?${params.toString()}`),
      fetch("/api/sections"),
    ]);
    const cJson = await cRes.json();
    const sJson = await sRes.json();
    if (cRes.ok) setRows(cJson.data);
    else setErr(cJson.error ?? "تعذر تحميل المحتوى");
    if (sRes.ok) setSections(sJson.data.sections);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  function reset() {
    setDraft(EMPTY);
    setErr(null);
  }

  async function startEdit(row: ContentRow) {
    setBusy("load-" + row.id);
    const res = await fetch(`/api/content/${row.id}`);
    const json = await res.json();
    setBusy(null);
    if (!res.ok || !json.data) {
      setErr("تعذر فتح العنصر");
      return;
    }
    const item = json.data;
    setDraft({
      id: item.id,
      kind: item.kind,
      title: item.title,
      summary: item.summary,
      body: item.body,
      sectionSlug: item.sectionSlug ?? "",
    });
    setMsg(null);
    setErr(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setErr(null);
    setMsg(null);
    const isEdit = Boolean(draft.id);
    const payload = {
      ...(isEdit ? {} : { kind: draft.kind }),
      title: draft.title,
      summary: draft.summary,
      body: draft.body,
      sectionSlug: draft.sectionSlug || null,
    };
    const res = await fetch(isEdit ? `/api/content/${draft.id}` : "/api/content", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setErr(json.error ?? "تعذر الحفظ");
      return;
    }
    setMsg(isEdit ? "تم حفظ التعديلات." : "تم إنشاء العنصر كمسودة.");
    setDraft(EMPTY);
    void load();
  }

  async function action(row: ContentRow, act: "publish" | "retract" | "verify") {
    setBusy(act + row.id);
    setErr(null);
    const res = await fetch(`/api/content/${row.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: act }),
    });
    const json = await res.json();
    setBusy(null);
    if (!res.ok) {
      setErr(json.error ?? "تعذر التنفيذ");
      return;
    }
    setMsg(
      act === "publish" ? "تم النشر." : act === "retract" ? "تم سحب العنصر." : "تم التحقق وحساب الدرجة.",
    );
    void load();
  }

  async function remove(row: ContentRow) {
    if (!confirm(`حذف «${row.title}» نهائياً؟`)) return;
    const res = await fetch(`/api/content/${row.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error ?? "تعذر الحذف");
      return;
    }
    setMsg("تم الحذف.");
    void load();
  }

  return (
    <div className="space-y-6">
      {msg && <div className="card border-emerald-500/40 p-3 text-sm text-emerald-700">{msg}</div>}
      {err && <div className="card border-rose-500/40 p-3 text-sm text-rose-700">{err}</div>}

      <section className="card p-5">
        <h2 className="mb-4 text-lg font-black">{draft.id ? "تعديل عنصر" : "إنشاء خبر / شائعة / تصحيح"}</h2>
        <form onSubmit={save} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm">
              النوع
              <select
                className="mt-1 w-full"
                value={draft.kind}
                disabled={Boolean(draft.id)}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft["kind"] })}
              >
                {Object.entries(CONTENT_KIND_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              القسم
              <select
                className="mt-1 w-full"
                value={draft.sectionSlug}
                onChange={(e) => setDraft({ ...draft, sectionSlug: e.target.value })}
              >
                <option value="">— بدون قسم —</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.slug}>{s.title}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-sm">
            العنوان *
            <input
              required
              className="mt-1 w-full"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label className="text-sm">
            الملخص *
            <textarea
              required
              rows={2}
              className="mt-1 w-full"
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            />
          </label>
          <label className="text-sm">
            النص الكامل *
            <textarea
              required
              rows={6}
              className="mt-1 w-full"
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </label>
          <div className="flex gap-2">
            <button className="btn-primary rounded-lg px-5 py-2 text-sm font-bold" disabled={busy === "save"}>
              {busy === "save" ? "جارٍ الحفظ..." : draft.id ? "حفظ التعديلات" : "إنشاء"}
            </button>
            {draft.id && (
              <button type="button" className="btn-ghost rounded-lg px-4 py-2 text-sm" onClick={reset}>
                إلغاء
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <h2 className="text-lg font-black">المحتوى ({rows.length})</h2>
          <div className="ms-auto flex flex-wrap gap-2">
            <select
              className="text-sm"
              value={filter.kind}
              onChange={(e) => setFilter({ ...filter, kind: e.target.value })}
            >
              <option value="ALL">كل الأنواع</option>
              {Object.entries(CONTENT_KIND_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <select
              className="text-sm"
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            >
              <option value="ALL">كل الحالات</option>
              {Object.entries(CONTENT_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <input
              className="text-sm"
              placeholder="بحث..."
              value={filter.q}
              onChange={(e) => setFilter({ ...filter, q: e.target.value })}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-right text-xs text-[var(--muted)]">
              <tr>
                <th className="py-2">العنوان</th>
                <th>النوع</th>
                <th>الحالة</th>
                <th>الحكم</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-2">
                    <span className="font-bold">{r.title}</span>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{r.summary.slice(0, 80)}…</p>
                  </td>
                  <td className="text-xs">{CONTENT_KIND_LABELS[r.kind]}</td>
                  <td className="text-xs">{CONTENT_STATUS_LABELS[r.status]}</td>
                  <td className="text-xs">
                    {VERDICT_LABELS[r.verdict]} {r.confidence > 0 && `(${r.confidence})`}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button className="chip text-xs" onClick={() => startEdit(r)}>تعديل</button>
                      {r.status !== "PUBLISHED" && (
                        <button className="chip text-xs text-emerald-700" onClick={() => action(r, "publish")}>
                          نشر
                        </button>
                      )}
                      {r.status === "PUBLISHED" && (
                        <button className="chip text-xs text-amber-700" onClick={() => action(r, "retract")}>
                          سحب
                        </button>
                      )}
                      <button className="chip text-xs" onClick={() => action(r, "verify")}>تحقق</button>
                      <button className="chip text-xs text-rose-600" onClick={() => remove(r)}>حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-[var(--muted)]">
                    لا يوجد محتوى مطابق.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
