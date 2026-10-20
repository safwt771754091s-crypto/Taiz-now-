import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { roleHasPermission } from "@/lib/rbac";
import OwnerConsole from "@/components/owner/OwnerConsole";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "لوحة المالك — تعز الآن",
};

export default async function OwnerPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!roleHasPermission(session.user.role, "platform:manage")) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-black">صلاحية غير كافية</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          لوحة المالك الكاملة متاحة للمسؤول والمحرر فقط.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block chip text-brand">
          رجوع للوحة التحكم
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="border-b-2 border-[var(--border-strong)] pb-5">
        <span className="eyebrow block">إدارة المنصة</span>
        <h1 className="headline mt-1 text-3xl font-bold">لوحة المالك</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          تحكم كامل في المنصة: أنشئ الأقسام وحرّرها، أنشئ الأخبار والشائعات والتصحيحات وانشرها،
          راقب البلاغات، أدر المستخدمين، وتابع كل نشاط على المنصة.
        </p>
      </header>
      <OwnerConsole />
    </div>
  );
}
