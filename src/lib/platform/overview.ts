import { prisma } from "@/lib/prisma";

/** Aggregated numbers shown on the owner's overview screen. */
export async function ownerOverview() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    contentByStatus,
    contentByKind,
    reportsByStatus,
    usersByRole,
    sections,
    visitsTotal,
    visitsWeek,
    distinctVisitorsWeek,
    loginsWeek,
    failedLoginsWeek,
    auditWeek,
    markers,
    sources,
  ] = await Promise.all([
    prisma.contentItem.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.contentItem.groupBy({ by: ["kind"], _count: { _all: true } }),
    prisma.report.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.section.count(),
    prisma.visit.count(),
    prisma.visit.count({ where: { createdAt: { gte: since } } }),
    prisma.visit.findMany({ where: { createdAt: { gte: since }, visitorId: { not: null } }, distinct: ["visitorId"], select: { visitorId: true } }),
    prisma.loginEvent.count({ where: { ok: true, createdAt: { gte: since } } }),
    prisma.loginEvent.count({ where: { ok: false, createdAt: { gte: since } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
    prisma.mapMarker.count(),
    prisma.source.count(),
  ]);

  const toMap = <T extends string>(rows: { _count: { _all: number } }[], key: keyof (typeof rows)[number]) =>
    Object.fromEntries(rows.map((r) => [String(r[key]), r._count._all])) as Record<T, number>;

  const statusMap = toMap<never>(contentByStatus as never, "status" as never);
  const kindMap = toMap<never>(contentByKind as never, "kind" as never);
  const reportMap = toMap<never>(reportsByStatus as never, "status" as never);
  const roleMap = toMap<never>(usersByRole as never, "role" as never);

  const totalContent = Object.values(statusMap as Record<string, number>).reduce((a, b) => a + b, 0);
  const totalReports = Object.values(reportMap as Record<string, number>).reduce((a, b) => a + b, 0);

  return {
    content: {
      total: totalContent,
      published: (statusMap as Record<string, number>).PUBLISHED ?? 0,
      verified: (statusMap as Record<string, number>).VERIFIED ?? 0,
      drafts: (statusMap as Record<string, number>).DRAFT ?? 0,
      inReview: (statusMap as Record<string, number>).IN_REVIEW ?? 0,
      byStatus: statusMap,
      byKind: kindMap,
    },
    reports: {
      total: totalReports,
      pending: (reportMap as Record<string, number>).PENDING ?? 0,
      underReview: (reportMap as Record<string, number>).UNDER_REVIEW ?? 0,
      byStatus: reportMap,
    },
    users: { total: Object.values(roleMap as Record<string, number>).reduce((a, b) => a + b, 0), byRole: roleMap },
    sections,
    markers,
    sources,
    visits: { total: visitsTotal, week: visitsWeek, distinctWeek: distinctVisitorsWeek.length },
    security: { loginsWeek, failedLoginsWeek, auditWeek },
  };
}
