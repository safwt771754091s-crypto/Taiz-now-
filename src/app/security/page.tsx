import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { roleHasPermission } from "@/lib/rbac";
import SecurityConsole from "@/components/SecurityConsole";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!roleHasPermission(session.user.role, "security:manage")) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-black">صلاحية غير كافية</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">مركز الأمن متاح للمسؤول ومدقق الحقائق.</p>
        <Link href="/dashboard" className="mt-4 inline-block chip text-brand">رجوع للوحة التحكم</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-black">مركز الأمن وسلامة الإعدادات</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          «الحارس» يراقب أي تغيير غير مصرّح به في الهوية أو البُرد أو الصلاحيات أو كلمات المرور أو القنوات، ويستعيد أنماط الإعدادات المعتمدة.
        </p>
      </header>
      <SecurityConsole />
    </div>
  );
}
