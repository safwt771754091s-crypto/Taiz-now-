"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CATEGORIES = [
  { value: "verified", label: "موثق" },
  { value: "rumor", label: "شائعة" },
  { value: "correction", label: "تصحيح" },
  { value: "incident", label: "حادثة" },
  { value: "general", label: "عام" },
];

export default function MarkerForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    label: "",
    lat: "",
    lng: "",
    category: "verified",
    description: "",
    confidence: "80",
  });
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; message?: string }>({
    status: "idle",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: form.label,
          lat: Number(form.lat),
          lng: Number(form.lng),
          category: form.category,
          description: form.description || undefined,
          confidence: Number(form.confidence),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "تعذر إضافة الموقع");
      setState({ status: "done", message: "أُضيف الموقع إلى الخريطة." });
      setForm({ ...form, label: "", lat: "", lng: "", description: "" });
      router.refresh();
    } catch (err) {
      setState({ status: "error", message: (err as Error).message });
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-6">
      <h2 className="text-lg font-black">إضافة موقع مُتحقق جغرافياً</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-bold">اسم الموقع</span>
          <input
            required
            minLength={2}
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="مثال: جسر تعز الرئيسي"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">التصنيف</span>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">خط العرض (lat)</span>
          <input
            required
            type="number"
            step="any"
            dir="ltr"
            value={form.lat}
            onChange={(e) => setForm({ ...form, lat: e.target.value })}
            placeholder="13.5795"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">خط الطول (lng)</span>
          <input
            required
            type="number"
            step="any"
            dir="ltr"
            value={form.lng}
            onChange={(e) => setForm({ ...form, lng: e.target.value })}
            placeholder="44.0209"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-bold">درجة الثقة</span>
          <input
            type="number"
            min={0}
            max={100}
            dir="ltr"
            value={form.confidence}
            onChange={(e) => setForm({ ...form, confidence: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-bold">الوصف (اختياري)</span>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="ملاحظة التحقق الجغرافي"
          />
        </label>
      </div>
      <button type="submit" className="btn btn-primary" disabled={state.status === "loading"}>
        {state.status === "loading" ? "جارٍ الإضافة..." : "إضافة الموقع"}
      </button>
      {state.message && (
        <p className={`text-sm ${state.status === "error" ? "text-red-400" : "text-emerald-400"}`}>{state.message}</p>
      )}
    </form>
  );
}
