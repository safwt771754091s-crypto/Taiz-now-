import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { roleHasPermission } from "@/lib/rbac";
import AgentsConsole from "@/components/AgentsConsole";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!roleHasPermission(session.user.role, "agents:manage")) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-black">صلاحية غير كافية</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          إدارة الوكلاء الأذكياء متاحة للمسؤول والمحرر والمدقق والناشر.
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
        <h1 className="text-2xl font-black">الوكلاء الأذكياء</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          بدل الحسابات البشرية — وكلاء ذكاء اصطناعي ينفّذون الرصد والتحقق والصياغة والنشر والتفنيد تلقائياً.
        </p>
      </header>
      <AgentsConsole />
    </div>
  );
}
