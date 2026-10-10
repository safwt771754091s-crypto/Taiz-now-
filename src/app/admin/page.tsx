import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { roleHasPermission } from "@/lib/rbac";
import UserManager from "@/components/UserManager";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!roleHasPermission(session.user.role, "users:manage")) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-black">صلاحية غير كافية</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          إدارة المستخدمين متاحة للمسؤول فقط.
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
        <h1 className="text-2xl font-black">إدارة المستخدمين والأدوار</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          إنشاء حسابات الفريق وتعديل الأدوار والصلاحيات.
        </p>
      </header>
      <UserManager />
    </div>
  );
}
