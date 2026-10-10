import { prisma } from "@/lib/prisma";
import type { ContentKind, ContentStatus } from "@prisma/client";

export const PUBLIC_STATUSES: ContentStatus[] = ["VERIFIED", "PUBLISHED"];

export async function listContent(opts: {
  kind?: ContentKind;
  q?: string;
  take?: number;
  statuses?: ContentStatus[];
}) {
  const { kind, q, take = 24, statuses = PUBLIC_STATUSES } = opts;
  return prisma.contentItem.findMany({
    where: {
      status: { in: statuses },
      ...(kind ? { kind } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { summary: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take,
    select: {
      id: true,
      kind: true,
      slug: true,
      title: true,
      summary: true,
      verdict: true,
      confidence: true,
      location: true,
      tags: true,
      publishedAt: true,
      lastReviewedAt: true,
    },
  });
}

export async function getContentBySlug(slug: string) {
  return prisma.contentItem.findUnique({
    where: { slug },
    include: {
      evidence: { include: { source: true } },
      scores: { orderBy: { computedAt: "desc" }, take: 1 },
      media: true,
      markers: true,
      createdBy: { select: { name: true } },
      reviewedBy: { select: { name: true } },
    },
  });
}

export async function platformStats() {
  const [news, rumors, corrections, reports, verified, markers] = await Promise.all([
    prisma.contentItem.count({ where: { kind: "NEWS", status: { in: PUBLIC_STATUSES } } }),
    prisma.contentItem.count({ where: { kind: "RUMOR", status: { in: PUBLIC_STATUSES } } }),
    prisma.contentItem.count({ where: { kind: "CORRECTION", status: { in: PUBLIC_STATUSES } } }),
    prisma.report.count(),
    prisma.contentItem.count({ where: { status: "VERIFIED" } }),
    prisma.mapMarker.count(),
  ]);
  return { news, rumors, corrections, reports, verified, markers };
}
