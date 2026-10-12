import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { roleHasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { visitSummary } from "@/lib/analytics/visits";
import { formatDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="headline text-3xl font-bold text-[var(--brand)]">{value}</p>
      <p className="text-sm font-bold">{label}</p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

function device(ua: string | null): string {
  if (!ua) return "غير معروف";
  if (/iphone|android|mobile/i.test(ua)) return "هاتف";
  if (/ipad|tablet/i.test(ua)) return "جهاز لوحي";
  if (/windows/i.test(ua)) return "ويندوز";
  if (/mac os/i.test(ua)) return "ماك";
  if (/linux/i.test(ua)) return "لينكس";
  return "أخرى";
}

function browser(ua: string | null): string {
  if (!ua) return "—";
  if (/edg/i.test(ua)) return "Edge";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  return "أخرى";
}

export default async function VisitorsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!roleHasPermission(session.user.role, "security:manage")) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-bold">صلاحية غير كافية</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">سجل الزوار متاح للمسؤول.</p>
        <Link href="/dashboard" className="link mt-4 inline-block text-sm">
          رجوع للوحة التحكم
        </Link>
      </div>
    );
  }

  const [summary, visits, topPaths, firstSeen] = await Promise.all([
    visitSummary(),
    prisma.visit.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { name: true, role: true } } },
    }),
    prisma.visit.groupBy({
      by: ["path"],
      _count: { _all: true },
      where: { isBot: false },
      orderBy: { _count: { path: "desc" } },
      take: 8,
    }),
    prisma.visit.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);

  return (
    <div className="space-y-6">
      <header className="border-b-2 border-[var(--border-strong)] pb-5">
        <span className="eyebrow block">لوحة المالك</span>
        <h1 className="headline mt-1 text-3xl font-bold md:text-4xl">من زار المنصة</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          كل زيارة تُسجَّل تلقائيًا: الصفحة، الوقت، الجهاز، والمصدر. الزيارات الآلية (محركات البحث
          والروبوتات) مفصولة عن الزوار الحقيقيين.
          {firstSeen && <> بدأ التسجيل في {formatDate(firstSeen.createdAt)}.</>}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="زيارات اليوم" value={summary.today} hint="منذ منتصف الليل" />
        <Stat label="زوّار مختلفون اليوم" value={summary.uniqueToday} hint="أجهزة فريدة" />
        <Stat label="زيارات آخر ٧ أيام" value={summary.week} />
        <Stat label="إجمالي الزيارات" value={summary.total} />
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">أكثر الصفحات زيارة</h2>
          <span className="chip text-[var(--muted)]">
            زوار حقيقيون {summary.humans} · روبوتات {summary.bots}
          </span>
        </div>
        {topPaths.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">لا توجد زيارات مسجّلة بعد.</p>
        ) : (
          <ul className="space-y-2">
            {topPaths.map((p) => {
              const max = topPaths[0]._count._all || 1;
              return (
                <li key={p.path}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-bold">{p.path}</span>
                    <span className="text-[var(--muted)]">{p._count._all}</span>
                  </div>
                  <div className="meter">
                    <span style={{ width: `${Math.round((p._count._all / max) * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-lg font-bold">آخر الزيارات</h2>
        </div>
        {visits.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">لا توجد زيارات مسجّلة بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-[var(--panel-2)] text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2 font-bold">الوقت</th>
                  <th className="px-4 py-2 font-bold">الصفحة</th>
                  <th className="px-4 py-2 font-bold">المستخدم</th>
                  <th className="px-4 py-2 font-bold">الجهاز</th>
                  <th className="px-4 py-2 font-bold">المتصفح</th>
                  <th className="px-4 py-2 font-bold">المصدر</th>
                  <th className="px-4 py-2 font-bold">IP</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id} className="border-t border-[var(--border)]">
                    <td className="whitespace-nowrap px-4 py-2 text-[var(--muted)]">
                      {formatDate(v.createdAt)}
                    </td>
                    <td className="px-4 py-2 font-bold">
                      {v.path}
                      {v.isBot && <span className="chip mr-2 text-[var(--muted)]">آلي</span>}
                    </td>
                    <td className="px-4 py-2">
                      {v.user?.name ?? <span className="text-[var(--muted)]">زائر</span>}
                    </td>
                    <td className="px-4 py-2">{device(v.userAgent)}</td>
                    <td className="px-4 py-2">{browser(v.userAgent)}</td>
                    <td className="px-4 py-2 text-[var(--muted)]">
                      {v.referer ? (
                        <span title={v.referer}>{v.referer.replace(/^https?:\/\//, "").split("/")[0]}</span>
                      ) : (
                        "مباشر"
                      )}
                    </td>
                    <td className="px-4 py-2 text-[var(--muted)]">{v.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs leading-relaxed text-[var(--muted)]">
        ملاحظة خصوصية: نحتفظ بسجل الزيارات لأغراض الأمن والتحليل فقط. تُحفظ معرّفات الزوار
        مُجزّأةً (hash) ولا نُخزّن محتوى أي صفحة زارها المستخدم.
      </p>
    </div>
  );
}
