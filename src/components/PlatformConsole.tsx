"use client";

import { useCallback, useEffect, useState } from "react";

type Brand = {
  name: string;
  nameEn: string;
  tagline: string;
  slogan: string;
  primary: string;
  accent: string;
  website: string | null;
};

type Email = { address: string; kindLabel: string; verified: boolean; provider: string; linkedVia: string };
type Page = { id: string; route: string; title: string; kind: string; systemRoute: boolean; agentBuilt: boolean; published: boolean; navOrder: number };
type Drift = { drifted: boolean; baselineHash: string | null; differences: string[] };

export default function PlatformConsole() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [drift, setDrift] = useState<Drift | null>(null);
  const [domain, setDomain] = useState("");
  const [linkEmail, setLinkEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/platform");
    const json = await res.json();
    if (res.ok) {
      setBrand(json.data.brand);
      setEmails(json.data.emails);
      setPages(json.data.pages);
      setDrift(json.data.drift);
      setDomain(json.data.domain);
    } else setErr(json.error ?? "تعذر التحميل");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveBrand() {
    if (!brand) return;
    setBusy("brand");
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/platform", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brand),
    });
    const json = await res.json();
    setBusy(null);
    if (res.ok) {
      setMsg("تم حفظ هوية المنصة.");
      await fetch("/api/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan" }),
      });
      load();
    } else setErr(json.error ?? "فشل الحفظ");
  }

  async function post(path: string, body: unknown, tag: string) {
    setBusy(tag);
    setErr(null);
    setMsg(null);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setBusy(null);
    if (res.ok) {
      setMsg("تم التنفيذ بنجاح.");
      load();
    } else setErr(json.error ?? "فشل التنفيذ");
  }

  return (
    <div className="space-y-6">
      {msg && <div className="card border-emerald-500/40 p-3 text-sm text-emerald-300">{msg}</div>}
      {err && <div className="card border-rose-500/40 p-3 text-sm text-rose-300">{err}</div>}

      {/* Brand identity */}
      <section className="card p-5">
        <h2 className="mb-4 text-lg font-black">هوية المنصة</h2>
        {brand && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              الاسم
              <input className="mt-1 w-full" value={brand.name} onChange={(e) => setBrand({ ...brand, name: e.target.value })} />
            </label>
            <label className="text-sm">
              الاسم بالإنجليزية
              <input className="mt-1 w-full" value={brand.nameEn} onChange={(e) => setBrand({ ...brand, nameEn: e.target.value })} />
            </label>
            <label className="text-sm">
              الوصف القصير
              <input className="mt-1 w-full" value={brand.tagline} onChange={(e) => setBrand({ ...brand, tagline: e.target.value })} />
            </label>
            <label className="text-sm">
              الشعار
              <input className="mt-1 w-full" value={brand.slogan} onChange={(e) => setBrand({ ...brand, slogan: e.target.value })} />
            </label>
            <label className="text-sm">
              اللون الأساسي
              <input type="color" className="mt-1 h-10 w-full" value={brand.primary} onChange={(e) => setBrand({ ...brand, primary: e.target.value })} />
            </label>
            <label className="text-sm">
              اللون الثانوي
              <input type="color" className="mt-1 h-10 w-full" value={brand.accent} onChange={(e) => setBrand({ ...brand, accent: e.target.value })} />
            </label>
            <label className="text-sm sm:col-span-2">
              الموقع الإلكتروني
              <input className="mt-1 w-full" dir="ltr" placeholder="https://example.org" value={brand.website ?? ""} onChange={(e) => setBrand({ ...brand, website: e.target.value })} />
            </label>
            <div className="sm:col-span-2">
              <button className="btn-primary rounded-lg px-4 py-2 text-sm font-bold" disabled={busy === "brand"} onClick={saveBrand}>
                {busy === "brand" ? "جارٍ الحفظ..." : "حفظ الهوية"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Email identity */}
      <section className="card p-5">
        <h2 className="mb-1 text-lg font-black">بريد المنصة الرسمي</h2>
        <p className="mb-4 text-xs text-[var(--muted)]">
          النطاق: <span dir="ltr">{domain}</span> — تُنشأ الصناديق في مزوّد البريد، ثم تُربط هنا لتكون مرجعاً موحّداً للمنصة ووكلائها.
        </p>
        <ul className="mb-4 divide-y divide-[var(--border)]">
          {emails.map((e) => (
            <li key={e.address} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span dir="ltr" className="font-mono text-sm">
                {e.address}
              </span>
              <span className="flex items-center gap-2 text-xs">
                <span className="chip">{e.kindLabel}</span>
                <span className={e.verified ? "text-emerald-300" : "text-amber-300"}>{e.verified ? "مُوثّق" : "بانتظار الربط"}</span>
              </span>
            </li>
          ))}
          {emails.length === 0 && <li className="py-2 text-sm text-[var(--muted)]">لم تُهيَّأ بعد — اضغط «تهيئة البُرد».</li>}
        </ul>
        <div className="flex flex-wrap gap-2">
          <button className="chip" disabled={busy === "prov"} onClick={() => post("/api/platform/email", { action: "provision" }, "prov")}>
            تهيئة البُرد ({domain})
          </button>
          <input className="w-56" dir="ltr" placeholder="info@taiznow.ye" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} />
          <button className="chip" disabled={busy === "link" || !linkEmail} onClick={() => post("/api/platform/email", { action: "link-google", email: linkEmail }, "link")}>
            ربط حساب جوجل
          </button>
        </div>
      </section>

      {/* Pages */}
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black">صفحات المنصة</h2>
          <button className="chip" disabled={busy === "sync"} onClick={() => post("/api/platform/pages", {}, "sync")}>
            مزامنة الصفحات
          </button>
        </div>
        {drift?.drifted && (
          <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            <b>تنبيه:</b> تغيّرت إعدادات منذ الخط المعتمد — {drift.differences.length} فرق. راجع «مركز الأمن».
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-right text-xs text-[var(--muted)]">
              <tr>
                <th className="py-2">المسار</th>
                <th>العنوان</th>
                <th>النوع</th>
                <th>المصدر</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {pages.map((p) => (
                <tr key={p.id}>
                  <td dir="ltr" className="py-2 font-mono text-xs">{p.route}</td>
                  <td>{p.title}</td>
                  <td className="text-xs text-[var(--muted)]">{p.kind}</td>
                  <td className="text-xs">{p.systemRoute ? "نظام" : p.agentBuilt ? "وكيل" : "يدوي"}</td>
                  <td className="text-xs">{p.published ? <span className="text-emerald-300">منشورة</span> : <span className="text-rose-300">مخفية</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
