"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Friendly, editorial-styled fallback so visitors never see a raw error page. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <span className="eyebrow block">حدث خطأ مؤقت</span>
      <h1 className="headline mt-2 text-3xl font-bold">تعذّر تحميل هذا القسم الآن</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        قد يكون السبب ضغطاً على الخدمة أو انقطاعاً مؤقتاً في قاعدة البيانات. حدّث الصفحة بعد قليل،
        وإن استمرت المشكلة فتواصل مع فريق المنصة.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={reset} className="btn-primary rounded-lg px-5 py-2.5 text-sm font-bold">
          إعادة المحاولة
        </button>
        <Link href="/" className="btn-ghost rounded-lg px-5 py-2.5 text-sm font-bold">
          الصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
