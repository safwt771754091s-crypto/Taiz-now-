"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("بيانات الدخول غير صحيحة");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-black">دخول فريق التحقق</h1>
      <label className="space-y-1 text-sm">
        <span className="font-bold">البريد الإلكتروني</span>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-bold">كلمة المرور</span>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
      <button disabled={loading} className="btn-primary w-full rounded-xl py-2.5 disabled:opacity-60">
        {loading ? "جارٍ الدخول..." : "دخول"}
      </button>
      <p className="text-center text-xs text-[var(--muted)]">
        الدخول مخصص لفريق التحرير والتحقق. الجمهور يمكنه تصفح كل شيء وإرسال البلاغات دون حساب.
      </p>
    </form>
  );
}
