import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** A distinct-visitor key derived from ip+userAgent — never the raw values. */
function visitorKey(ip: string | null, ua: string | null): string {
  return createHash("sha256").update(`${ip ?? "?"}|${ua ?? "?"}`).digest("hex").slice(0, 32);
}

const BOT_RE =
  /bot|crawler|spider|crawl|slurp|bingpreview|facebookexternalhit|whatsapp|telegrambot|curl|wget|python-requests|headless|lighthouse|monitoring|uptime/i;

/** Record a page view. Never throws — analytics must not break a request. */
export async function recordVisit(input: {
  path: string;
  referer: string | null;
  ip: string | null;
  userAgent: string | null;
  country: string | null;
  city: string | null;
  userId: string | null;
}): Promise<void> {
  try {
    await prisma.visit.create({
      data: {
        path: input.path.slice(0, 300),
        referer: input.referer?.slice(0, 500) ?? null,
        ip: input.ip,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
        country: input.country,
        city: input.city,
        isBot: BOT_RE.test(input.userAgent ?? ""),
        visitorId: visitorKey(input.ip, input.userAgent),
        userId: input.userId,
      },
    });
  } catch (err) {
    console.error("[visit-error]", err);
  }
}

export type VisitSummary = {
  total: number;
  today: number;
  week: number;
  uniqueToday: number;
  humans: number;
  bots: number;
};

export async function visitSummary(): Promise<VisitSummary> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [total, today, week, humans, bots, uniq] = await Promise.all([
    prisma.visit.count(),
    prisma.visit.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.visit.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.visit.count({ where: { isBot: false } }),
    prisma.visit.count({ where: { isBot: true } }),
    prisma.visit.findMany({
      where: { createdAt: { gte: startOfDay }, isBot: false },
      distinct: ["visitorId"],
      select: { visitorId: true },
    }),
  ]);
  return { total, today, week, uniqueToday: uniq.length, humans, bots };
}
