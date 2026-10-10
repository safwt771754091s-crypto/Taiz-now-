import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS, roleHasPermission, PERMISSION_LABELS, type Permission } from "@/lib/rbac";
import { CONTENT_STATUS_LABELS, REPORT_STATUS_LABELS, VERDICT_LABELS, formatDate } from "@/lib/labels";
import { platformStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-black">{value}</p>
      <p className="text-sm text-[var(--muted)]">{label}</p>
    </div>
  );
}

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const role = session.user.role;

  const [stats, pendingReports, drafts] = await Promise.all([
    platformStats(),
    roleHasPermission(role, "report:triage")
      ? prisma.report.findMany({
          where: { status: { in: ["PENDING", "UNDER_REVIEW"] } },
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
          take: 8,
        })
      : Promise.resolve([]),
    roleHasPermission(role, "content:edit")
      ? prisma.contentItem.findMany({
          where: { status: { in: ["DRAFT", "IN_REVIEW"] } },
          orderBy: { updatedAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
  ]);

  const permissions = (Object.keys(PERMISSION_LABELS) as Permission[]).filter((p) =>
    roleHasPermission(role, p),
  );

  return (
    <div className="space-y-6">
      <header className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h1 className="text-2xl font-black">لوحة التحكم</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            مرحباً {session.user.name} — {ROLE_LABELS[role]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {roleHasPermission(role, "report:triage") && (
            <span className="chip border-brand/40 text-brand">فرز البلاغات متاح</span>
          )}
          {roleHasPermission(role, "agents:manage") && (
            <Link href="/agents" className="chip border-brand/40 text-brand">
              الوكلاء الأذكياء
            </Link>
          )}
          {roleHasPermission(role, "social:manage") && (
            <Link href="/social" className="chip border-brand/40 text-brand">
              وسائل التواصل
            </Link>
          )}
          {roleHasPermission(role, "users:manage") && (
            <Link href="/admin" className="chip border-brand/40 text-brand">
              إدارة المستخدمين
            </Link>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="أخبار منشورة" value={stats.news} />
        <Stat label="شائعات" value={stats.rumors} />
        <Stat label="تصحيحات" value={stats.corrections} />
        <Stat label="بلاغات" value={stats.reports} />
        <Stat label="موثق" value={stats.verified} />
        <Stat label="مواقع" value={stats.markers} />
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-bold">صلاحياتك</h2>
        <div className="flex flex-wrap gap-2">
          {permissions.map((p) => (
            <span key={p} className="chip text-[var(--muted)]">
              {PERMISSION_LABELS[p]}
            </span>
          ))}
        </div>
      </section>

      {pendingReports.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">بلاغات تنتظر الفرز</h2>
          <ul className="divide-y divide-[var(--border)]">
            {pendingReports.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{r.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {REPORT_STATUS_LABELS[r.status]} · {formatDate(r.createdAt)}
                    {r.anonymous && " · مجهول"}
                  </p>
                </div>
                <Link href="/reports" className="chip text-brand">
                  معالجة
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {drafts.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">محتوى قيد الإعداد</h2>
          <ul className="divide-y divide-[var(--border)]">
            {drafts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{c.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {CONTENT_STATUS_LABELS[c.status]} · {VERDICT_LABELS[c.verdict]} · {c.confidence}/100
                  </p>
                </div>
                <Link href={`/news/${c.slug}`} className="chip text-brand">
                  عرض
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
