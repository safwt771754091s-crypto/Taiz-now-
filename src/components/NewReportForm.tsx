"use client";

import { useState } from "react";

const TYPES = [
  { value: "NEWS", label: "خبر" },
  { value: "IMAGE", label: "صورة" },
  { value: "VIDEO", label: "فيديو" },
  { value: "MESSAGE", label: "رسالة/منشور" },
  { value: "OTHER", label: "أخرى" },
];

export default function NewReportForm() {
  const [form, setForm] = useState({
    type: "NEWS",
    title: "",
    description: "",
    mediaUrl: "",
    location: "",
    anonymous: false,
    reporterName: "",
    reporterContact: "",
  });
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; message?: string }>({
    status: "idle",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "تعذر إرسال البلاغ");
      setState({ status: "done", message: `تم استلام بلاغك بنجاح. رقم البلاغ: ${json.data.id}` });
      setForm({ ...form, title: "", description: "", mediaUrl: "", location: "" });
    } catch (err) {
      setState({ status: "error", message: (err as Error).message });
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-bold">نوع البلاغ</span>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">الموقع (اختياري)</span>
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="مثال: تعز — شارع جمال"
          />
        </label>
      </div>

      <label className="space-y-1 text-sm">
        <span className="font-bold">عنوان البلاغ</span>
        <input
          required
          minLength={5}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="اكتب ملخصاً قصيراً لما تريد التحقق منه"
        />
      </label>

      <label className="space-y-1 text-sm">
        <span className="font-bold">الوصف التفصيلي</span>
        <textarea
          required
          minLength={10}
          rows={5}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="اشرح ما تدّعيه، ومصدر المعلومة، وأي تفاصيل تساعد فريق التحقق"
        />
      </label>

      <label className="space-y-1 text-sm">
        <span className="font-bold">رابط صورة أو فيديو (اختياري)</span>
        <input
          type="url"
          value={form.mediaUrl}
          onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })}
          placeholder="https://..."
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={form.anonymous}
          onChange={(e) => setForm({ ...form, anonymous: e.target.checked })}
        />
        <span>إرسال مجهول (لن نحفظ اسمك أو بياناتك)</span>
      </label>

      {!form.anonymous && (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-bold">الاسم (اختياري)</span>
            <input value={form.reporterName} onChange={(e) => setForm({ ...form, reporterName: e.target.value })} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-bold">وسيلة تواصل (اختياري)</span>
            <input
              value={form.reporterContact}
              onChange={(e) => setForm({ ...form, reporterContact: e.target.value })}
              placeholder="بريد أو رقم"
            />
          </label>
        </div>
      )}

      <button type="submit" disabled={state.status === "loading"} className="btn-primary rounded-xl px-6 py-2.5 disabled:opacity-60">
        {state.status === "loading" ? "جارٍ الإرسال..." : "إرسال البلاغ"}
      </button>

      {state.status === "done" && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {state.message}
        </p>
      )}
      {state.status === "error" && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          {state.message}
        </p>
      )}
    </form>
  );
}
