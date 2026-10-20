"use client";

import { useCallback, useEffect, useState } from "react";
import type { Section } from "@prisma/client";

type Draft = {
  id?: string;
  title: string;
  slug: string;
  titleEn: string;
  description: string;
  icon: string;
  color: string;
  navOrder: number;
  published: boolean;
};

const EMPTY: Draft = {
  title: "",
  slug: "",
  titleEn: "",
  description: "",
  icon: "",
  color: "#b3121d",
  navOrder: 100,
  published: true,
};

/** Owner screen: create, edit, reorder, hide and delete site sections. */
export default function SectionsManager() {
  const [sections, setSections] = useState<Section[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/sections");
    const json = await res.json();
    if (res.ok) setSections(json.data.sections);
    else setErr(json.error ?? "تعذر تحميل الأقسام");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function reset() {
    setDraft(EMPTY);
    setMsg(null);
    setErr(null);
  }

  function startEdit(s: Section) {
    setDraft({
      id: s.id,
      title: s.title,
      slug: s.slug,
      titleEn: s.titleEn ?? "",
      description: s.description ?? "",
      icon: s.icon ?? "",
      color: s.color ?? "#b3121d",
      navOrder: s.navOrder,
      published: s.published,
    });
    setMsg(null);
    setErr(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const isEdit = Boolean(draft.id);
    const payload = {
      title: draft.title,
      titleEn: draft.titleEn || undefined,
      description: draft.description || undefined,
      icon: draft.icon || undefined,
      color: draft.color || undefined,
      navOrder: Number(draft.navOrder) || 100,
      published: draft.published,
      ...(isEdit ? {} : { slug: draft.slug || undefined }),
    };
    const res = await fetch(isEdit ? `/api/sections/${draft.id}` : "/api/sections", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErr(json.error ?? "تعذر الحفظ");
      return;
    }
    setMsg(isEdit ? "تم تحديث القسم." : "تم إنشاء القسم.");
    setDraft(EMPTY);
    void load();
  }

  async function togglePublished(s: Section) {
    setErr(null);
    const res = await fetch(`/api/sections/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !s.published }),
    });
    if (!res.ok) {
      const json = await res.json();
      setErr(json.error ?? "تعذر التغيير");
      return;
    }
    void load();
  }

  async function move(s: Section, delta: number) {
    const res = await fetch(`/api/sections/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ navOrder: Math.max(0, s.navOrder + delta) }),
    });
    if (res.ok) void load();
  }

  async function remove(s: Section) {
    if (!confirm(`حذف قسم «${s.title}»؟`)) return;
    setErr(null);
    const res = await fetch(`/api/sections/${s.id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setErr(json.error ?? "تعذر الحذف");
      return;
    }
    setMsg("تم حذف القسم.");
    void load();
  }

  return (
    <div className="space-y-6">
      {msg && <div className="card border-emerald-500/40 p-3 text-sm text-emerald-700">{msg}</div>}
      {err && <div className="card border-rose-500/40 p-3 text-sm text-rose-700">{err}</div>}

      <section className="card p-5">
        <h2 className="mb-4 text-lg font-black">{draft.id ? "تعديل قسم" : "إنشاء قسم جديد"}</h2>
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            اسم القسم *
            <input
              required
              className="mt-1 w-full"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="مثال: اقتصاد"
            />
          </label>
          <label className="text-sm">
            الاسم بالإنجليزية
            <input
              className="mt-1 w-full"
              dir="ltr"
              value={draft.titleEn}
              onChange={(e) => setDraft({ ...draft, titleEn: e.target.value })}
              placeholder="Economy"
            />
          </label>
          {!draft.id && (
            <label className="text-sm">
              المُعرّف (بالإنجليزية، يُستخدم في الرابط)
              <input
                className="mt-1 w-full"
                dir="ltr"
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                placeholder="economy"
              />
            </label>
          )}
          <label className="text-sm">
            الأيقونة (رمز تعبيري)
            <input
              className="mt-1 w-full"
              value={draft.icon}
              onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
              placeholder="💰"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            الوصف
            <input
              className="mt-1 w-full"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="وصف مختصر يظهر في ترويسة القسم"
            />
          </label>
          <label className="text-sm">
            اللون
            <input
              type="color"
              className="mt-1 h-10 w-full"
              value={draft.color}
              onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            />
          </label>
          <label className="text-sm">
            الترتيب (الأصغر أولاً)
            <input
              type="number"
              className="mt-1 w-full"
              value={draft.navOrder}
              onChange={(e) => setDraft({ ...draft, navOrder: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={draft.published}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
            />
            ظاهر على الموقع
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button className="btn-primary rounded-lg px-5 py-2 text-sm font-bold" disabled={busy}>
              {busy ? "جارٍ الحفظ..." : draft.id ? "حفظ التعديلات" : "إنشاء القسم"}
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
        <h2 className="mb-4 text-lg font-black">الأقسام الحالية ({sections.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-right text-xs text-[var(--muted)]">
              <tr>
                <th className="py-2">القسم</th>
                <th>المُعرّف</th>
                <th>الترتيب</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {sections.map((s) => (
                <tr key={s.id}>
                  <td className="py-2">
                    <span className="flex items-center gap-2 font-bold">
                      {s.icon && <span>{s.icon}</span>}
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ background: s.color ?? "var(--brand)" }}
                      />
                      {s.title}
                      {s.system && <span className="chip text-[10px]">أساسي</span>}
                    </span>
                    {s.description && <p className="mt-0.5 text-xs text-[var(--muted)]">{s.description}</p>}
                  </td>
                  <td dir="ltr" className="font-mono text-xs">{s.slug}</td>
                  <td className="text-xs">{s.navOrder}</td>
                  <td className="text-xs">
                    {s.published ? (
                      <span className="text-emerald-600">ظاهر</span>
                    ) : (
                      <span className="text-rose-600">مخفي</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button className="chip text-xs" onClick={() => startEdit(s)}>تعديل</button>
                      <button className="chip text-xs" onClick={() => move(s, -10)} title="تقديم">↑</button>
                      <button className="chip text-xs" onClick={() => move(s, 10)} title="تأخير">↓</button>
                      <button className="chip text-xs" onClick={() => togglePublished(s)}>
                        {s.published ? "إخفاء" : "إظهار"}
                      </button>
                      {!s.system && (
                        <button className="chip text-xs text-rose-600" onClick={() => remove(s)}>
                          حذف
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sections.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-[var(--muted)]">
                    لا توجد أقسام بعد.
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
