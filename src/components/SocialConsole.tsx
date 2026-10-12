"use client";

import { useCallback, useEffect, useState } from "react";

type Connection = {
  id: string;
  provider: string;
  displayName: string;
  mode: "MOCK" | "LIVE";
  enabled: boolean;
  handle: string | null;
  accountName: string | null;
  postCount: number;
  errorCount: number;
  lastPostedAt: string | null;
  expiresAt: string | null;
};

type Identity = {
  id: string;
  provider: string;
  handle: string | null;
  email: string | null;
  connected: boolean;
  linkedVia: string | null;
};

function fmt(dt: string | null) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" });
}

/** Warn when a stored credential is about to expire or already has. */
function expiryHint(expiresAt: string | null): { tone: string; text: string } | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { tone: "text-red-400", text: "انتهى التوكن — أعد الربط" };
  if (ms < 24 * 3600 * 1000)
    return { tone: "text-amber-300", text: `ينتهي التوكن بعد ${Math.max(1, Math.round(ms / 3600000))} ساعة` };
  return null;
}

export default function SocialConsole() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [googleEmail, setGoogleEmail] = useState("taiznow@gmail.com");
  const [fbToken, setFbToken] = useState("");
  const [fbSecret, setFbSecret] = useState("");
  const [post, setPost] = useState({ title: "", body: "" });
  const [items, setItems] = useState<{ id: string; title: string; kind: string }[]>([]);
  const [sched, setSched] = useState({ contentItemId: "", scheduledAt: "" });

  const load = useCallback(async () => {
    const res = await fetch("/api/social");
    const json = await res.json();
    if (res.ok) {
      setConnections(json.data.connections);
      setIdentities(json.data.identities);
    } else {
      setErr(json.error ?? "تعذر تحميل القنوات");
    }
  }, []);

  const loadItems = useCallback(async () => {
    const res = await fetch("/api/content?status=PUBLISHED&take=50");
    const json = await res.json();
    if (res.ok) setItems(json.data.map((i: { id: string; title: string; kind: string }) => ({ id: i.id, title: i.title, kind: i.kind })));
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
      await loadItems();
    })();
  }, [load, loadItems]);

  useEffect(() => {
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const fb = params.get("fb");
      if (fb === "ok") {
        setMsg(`تم ربط صفحة فيسبوك: ${params.get("page") ?? ""} — الوضع الآن مباشر ✅`);
        window.history.replaceState({}, "", "/social");
      } else if (fb === "error") {
        setErr(`فشل ربط فيسبوك: ${params.get("message") ?? "خطأ غير معروف"}`);
        window.history.replaceState({}, "", "/social");
      }
    })();
  }, []);

  async function schedule(e: React.FormEvent) {
    e.preventDefault();
    setBusy("schedule");
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/social/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "schedule-content",
        contentItemId: sched.contentItemId,
        scheduledAt: sched.scheduledAt ? new Date(sched.scheduledAt).toISOString() : undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) setErr(json.error ?? "تعذر الجدولة");
    else setMsg(`تمت جدولة النشر على ${json.data.scheduled} قناة.`);
    setBusy(null);
    load();
  }

  async function toggle(id: string, enabled: boolean) {
    setBusy(id);
    await fetch(`/api/social/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    setBusy(null);
    load();
  }

  async function connect(provider: string) {
    setBusy(provider);
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/social/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "connect", provider }),
    });
    const json = await res.json();
    if (!res.ok) setErr(json.error ?? "تعذر الربط");
    else setMsg(`تم ربط ${json.data.displayName} (${json.data.mode}).`);
    setBusy(null);
    load();
  }

  async function connectFacebookToken(e: React.FormEvent) {
    e.preventDefault();
    setBusy("fb-token");
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/social/facebook/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userToken: fbToken.trim(), appSecret: fbSecret.trim() || undefined }),
    });
    const json = await res.json();
    if (!res.ok) setErr(json.error ?? "تعذر ربط فيسبوك");
    else {
      setMsg(json.message ?? `تم ربط صفحة فيسبوك: ${json.data.page} — الوضع الآن مباشر ✅`);
      setFbToken("");
      setFbSecret("");
    }
    setBusy(null);
    load();
  }

  async function linkGoogle() {
    setBusy("google");
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/social/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: googleEmail }),
    });
    const json = await res.json();
    if (!res.ok) setErr(json.error ?? "تعذر ربط حساب جوجل");
    else setMsg("تم ربط حساب جوجل وربط القنوات المرتبطة به.");
    setBusy(null);
    load();
  }

  async function publishText(e: React.FormEvent) {
    e.preventDefault();
    setBusy("publish");
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/social/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish-text", ...post }),
    });
    const json = await res.json();
    if (!res.ok) setErr(json.error ?? "تعذر النشر");
    else {
      const okCount = json.data.outcomes.filter((o: { ok: boolean }) => o.ok).length;
      setMsg(`تم النشر على ${okCount} قناة.`);
      setPost({ title: "", body: "" });
    }
    setBusy(null);
    load();
  }

  const google = identities.find((i) => i.provider === "google");

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-bold">حساب المنصة على جوجل</h2>
        <p className="text-sm text-[var(--muted)]">
          ربط حساب جوجل يمهّد لربط القنوات المرتبطة به (مثل يوتيوب) وإدارتها من مكان واحد.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="font-bold">بريد حساب جوجل</span>
            <input type="email" value={googleEmail} onChange={(e) => setGoogleEmail(e.target.value)} />
          </label>
          <button
            onClick={linkGoogle}
            disabled={busy !== null}
            className="btn-primary rounded-xl px-5 py-2.5 disabled:opacity-50"
          >
            {busy === "google" ? "جارٍ الربط..." : "ربط حساب جوجل"}
          </button>
          {google?.connected && (
            <span className="chip border-emerald-400/40 text-emerald-300">
              مربوط: {google.email ?? google.handle}
            </span>
          )}
        </div>
      </section>

      {msg && <p className="card p-3 text-sm text-emerald-300">{msg}</p>}
      {err && <p className="card p-3 text-sm text-rose-300">{err}</p>}

      <section className="card overflow-x-auto p-5">
        <h2 className="mb-3 text-lg font-bold">قنوات النشر</h2>
        <table className="w-full text-right text-sm">
          <thead className="text-[var(--muted)]">
            <tr>
              <th className="p-2">المنصة</th>
              <th className="p-2">الحساب</th>
              <th className="p-2">النمط</th>
              <th className="p-2">المنشورات</th>
              <th className="p-2">آخر نشر</th>
              <th className="p-2">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {connections.map((c) => (
              <tr key={c.id} className="border-t border-[var(--border)]">
                <td className="p-2 font-bold">{c.displayName}</td>
                <td className="p-2 text-[var(--muted)]">{c.handle ?? "—"}</td>
                <td className="p-2">
                  <span className={`chip ${c.mode === "LIVE" ? "text-emerald-300" : "text-amber-300"}`}>
                    {c.mode === "LIVE" ? "مباشر" : "محاكاة"}
                  </span>
                  {expiryHint(c.expiresAt) && (
                    <div className={`mt-1 text-xs ${expiryHint(c.expiresAt)!.tone}`}>
                      {expiryHint(c.expiresAt)!.text}
                    </div>
                  )}
                </td>
                <td className="p-2">{c.postCount}</td>
                <td className="p-2 text-xs text-[var(--muted)]">{fmt(c.lastPostedAt)}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => toggle(c.id, !c.enabled)}
                      disabled={busy !== null}
                      className={`chip ${c.enabled ? "text-emerald-300" : "text-[var(--muted)]"}`}
                    >
                      {c.enabled ? "مفعّلة" : "معطّلة"}
                    </button>
                    {c.mode === "MOCK" && (
                      <div className="flex flex-wrap gap-1">
                        <button onClick={() => connect(c.provider)} className="chip text-brand">
                          ربط مباشر
                        </button>
                        {c.provider === "facebook" && (
                          // Full-page navigation is required: this is the OAuth redirect endpoint.
                          // eslint-disable-next-line @next/next/no-html-link-for-pages
                          <a href="/api/social/facebook" className="chip text-[#1877f2]">
                            ربط بنقرة واحدة
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-[var(--muted)]">
          وضع المحاكاة يسجّل المنشورات محلياً دون شبكة. لإتاحة النشر المباشر أضف مفاتيح كل منصة في متغيرات البيئة.
        </p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">ربط فيسبوك بالتوكن (طريقة بديلة مضمونة)</h2>
        <p className="text-xs text-[var(--muted)]">
          إن فشل زر «ربط بنقرة واحدة»، استخدم هذه الطريقة. أنشئ توكن من{" "}
          <a
            className="text-brand underline"
            href="https://developers.facebook.com/tools/explorer/"
            target="_blank"
            rel="noreferrer"
          >
            Graph API Explorer
          </a>{" "}
          بصلاحيات pages_show_list وpages_read_engagement وpages_manage_posts، ثم الصقه هنا.
        </p>
        <form onSubmit={connectFacebookToken} className="space-y-2">
          <input
            required
            className="w-full"
            placeholder="الصق توكن الوصول هنا..."
            value={fbToken}
            onChange={(e) => setFbToken(e.target.value)}
          />
          <input
            type="password"
            className="w-full"
            placeholder="المفتاح السري للتطبيق (اختياري — لجعل التوكن دائماً ♾️)"
            value={fbSecret}
            onChange={(e) => setFbSecret(e.target.value)}
          />
          <button className="chip text-[#1877f2]" disabled={busy === "fb-token"}>
            {busy === "fb-token" ? "جارٍ الربط..." : "ربط بالتوكن"}
          </button>
        </form>
        <p className="text-xs text-[var(--muted)]">
          المفتاح السري يُستخدم مرة واحدة لتوليد توكن دائم، ولا يُحفظ في المنصة.
        </p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">نشر بيان/ردّ مباشر</h2>
        <form onSubmit={publishText} className="space-y-3">
          <input
            required
            placeholder="العنوان"
            value={post.title}
            onChange={(e) => setPost({ ...post, title: e.target.value })}
          />
          <textarea
            required
            rows={5}
            placeholder="نص البيان..."
            value={post.body}
            onChange={(e) => setPost({ ...post, body: e.target.value })}
          />
          <button disabled={busy !== null} className="btn-primary rounded-xl px-6 py-2.5 disabled:opacity-50">
            {busy === "publish" ? "جارٍ النشر..." : "نشر على كل القنوات المفعّلة"}
          </button>
        </form>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">جدولة النشر</h2>
        <p className="text-sm text-[var(--muted)]">
          اختر خبراً موثّقاً ووقتاً مستقبلياً؛ سيطلقه وكيل النشر تلقائياً عند حلول الوقت.
        </p>
        <form onSubmit={schedule} className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-bold">المحتوى المنشور</span>
            <select
              required
              value={sched.contentItemId}
              onChange={(e) => setSched({ ...sched, contentItemId: e.target.value })}
            >
              <option value="">— اختر —</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-bold">وقت النشر (اختياري — الافتراضي بعد ساعة)</span>
            <input
              type="datetime-local"
              dir="ltr"
              value={sched.scheduledAt}
              onChange={(e) => setSched({ ...sched, scheduledAt: e.target.value })}
            />
          </label>
          <button disabled={busy !== null} className="btn-primary rounded-xl px-6 py-2.5 disabled:opacity-50">
            {busy === "schedule" ? "جارٍ الجدولة..." : "جدولة النشر"}
          </button>
        </form>
      </section>
    </div>
  );
}
