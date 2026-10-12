import { prisma } from "@/lib/prisma";
import { deliver } from "./publisher";

export type ScheduleResult = { scheduled: number; platforms: string[] };

/**
 * Queue a content item's social posts for later delivery. Each enabled channel
 * gets a row in "scheduled" state; the publisher agent releases rows whose time
 * has come. Nothing is sent at scheduling time.
 */
export async function scheduleContent(contentItemId: string, when: Date): Promise<ScheduleResult> {
  const item = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    include: { socialPosts: true },
  });
  if (!item) throw new Error("المحتوى غير موجود");

  const connections = await prisma.socialConnection.findMany({ where: { enabled: true } });
  const alreadyQueued = new Set(
    item.socialPosts.filter((p) => p.status === "scheduled").map((p) => p.platform),
  );

  const platforms: string[] = [];
  for (const conn of connections) {
    if (alreadyQueued.has(conn.provider)) continue;
    const latest = item.socialPosts
      .filter((p) => p.platform === conn.provider)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const body = latest?.body ?? `${item.title}\n\n${item.summary}`;
    await prisma.socialPost.create({
      data: {
        platform: conn.provider,
        body,
        status: "scheduled",
        scheduledAt: when,
        contentItemId: item.id,
      },
    });
    platforms.push(conn.provider);
  }
  return { scheduled: platforms.length, platforms };
}

export type ReleaseResult = {
  due: number;
  published: number;
  failed: number;
  outcomes: { id: string; platform: string; ok: boolean; detail: string }[];
};

/** Deliver every scheduled post whose time has come. Safe to call repeatedly. */
export async function releaseDuePosts(limit = 25): Promise<ReleaseResult> {
  const due = await prisma.socialPost.findMany({
    where: { status: "scheduled", scheduledAt: { lte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });

  const outcomes: ReleaseResult["outcomes"] = [];
  let published = 0;
  let failed = 0;

  for (const post of due) {
    const conn = await prisma.socialConnection.findUnique({ where: { provider: post.platform } });
    const result = await deliver({ provider: post.platform, handle: conn?.handle, body: post.body });
    await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: result.ok ? "published" : "failed",
        publishedAt: result.ok ? new Date() : null,
        error: result.ok ? null : result.detail,
      },
    });
    if (conn) {
      await prisma.socialConnection.update({
        where: { id: conn.id },
        data: {
          lastPostedAt: result.ok ? new Date() : conn.lastPostedAt,
          postCount: result.ok ? { increment: 1 } : undefined,
          errorCount: result.ok ? undefined : { increment: 1 },
        },
      });
    }
    if (result.ok) published++;
    else failed++;
    outcomes.push({ id: post.id, platform: post.platform, ok: result.ok, detail: result.detail });
  }

  return { due: due.length, published, failed, outcomes };
}
