import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { roleHasPermission } from "@/lib/rbac";
import PlatformConsole from "@/components/PlatformConsole";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!roleHasPermission(session.user.role, "platform:manage")) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-black">صلاحية غير كافية</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">إدارة هوية المنصة وبُردها وصفحاتها متاحة للمسؤول والمحرر.</p>
        <Link href="/dashboard" className="mt-4 inline-block chip text-brand">رجوع للوحة التحكم</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-black">هوية المنصة والبريد</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          بريد رسمي باسم المنصة، هوية موحّدة، وسجل بالصفحات التي ينشئها «الحارس» ويتحقق من سلامتها.
        </p>
      </header>
      <PlatformConsole />
    </div>
  );
}
