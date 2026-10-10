import Link from "next/link";
import NewReportForm from "@/components/NewReportForm";

export default function NewReportPage() {
  return (
    <div className="space-y-4">
      <nav className="text-sm text-[var(--muted)]">
        <Link href="/reports" className="hover:text-white">
          البلاغات
        </Link>{" "}
        / <span className="text-white/80">بلاغ جديد</span>
      </nav>
      <header>
        <h1 className="text-2xl font-black">إرسال بلاغ</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          كل الحقول تُعالج بسرية. الإرسال المجهول متاح بالكامل.
        </p>
      </header>
      <NewReportForm />
    </div>
  );
}
