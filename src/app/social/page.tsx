import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { roleHasPermission } from "@/lib/rbac";
import SocialConsole from "@/components/SocialConsole";

export const dynamic = "force-dynamic";

export default async function SocialPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!roleHasPermission(session.user.role, "social:manage")) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-black">صلاحية غير كافية</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          إدارة القنوات الاجتماعية متاحة للمسؤول والناشر الاجتماعي.
        </p>
        <Link href="/dashboard" className="mt-4 inline-block chip text-brand">
          رجوع للوحة التحكم
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-black">وسائل التواصل الاجتماعي</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          ربط حساب المنصة على جوجل، وربط قنوات النشر (مكتوبة ومسموعة ومرئية)، والنشر التلقائي الموثّق.
        </p>
      </header>
      <SocialConsole />
    </div>
  );
}
