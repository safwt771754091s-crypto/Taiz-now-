import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <span className="eyebrow block">404</span>
      <h1 className="headline mt-2 text-3xl font-bold">الصفحة غير موجودة</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        الرابط الذي تحاول الوصول إليه غير متاح أو تم نقله. جرّب العودة إلى الصفحة الرئيسية.
      </p>
      <Link href="/" className="btn-primary mt-6 inline-block rounded-lg px-5 py-2.5 text-sm font-bold">
        الصفحة الرئيسية
      </Link>
    </div>
  );
}
