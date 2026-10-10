import { prisma } from "@/lib/prisma";
import { PROVIDER_MAP, PROVIDERS, providerEnvPresent, resolveMode, GOOGLE_LINKED_PROVIDERS } from "./providers";
import { deliver } from "./publisher";
import { draftSocialPosts } from "@/lib/ai";
import { VERDICT_LABELS } from "@/lib/labels";

export type PublishOutcome = {
  provider: string;
  label: string;
  ok: boolean;
  mode: "mock" | "live";
  detail: string;
};

function baseUrl() {
  const configured = process.env.PLATFORM_URL || process.env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/$/, "");
  return "https://taiznow.ye";
}

/** Ensure all known providers exist as connections and identities (idempotent). */
export async function ensureConnections(): Promise<void> {
  for (const def of PROVIDERS) {
    const mode = resolveMode(def);
    await prisma.socialConnection.upsert({
      where: { provider: def.provider },
      create: {
        provider: def.provider,
        displayName: def.label,
        mode,
        enabled: true,
        handle: `${def.handlePrefix}taiznow`,
        accountName: "تعز الآن",
      },
      update: { displayName: def.label, mode },
    });
    await prisma.platformIdentity.upsert({
      where: { provider: def.provider },
      create: { provider: def.provider, handle: `${def.handlePrefix}taiznow` },
      update: {},
    });
  }
}

/** Connect or configure a provider account. */
export async function connectProvider(input: {
  provider: string;
  handle?: string;
  accountName?: string;
  enabled?: boolean;
  credentials?: Record<string, unknown>;
}) {
  const def = PROVIDER_MAP.get(input.provider);
  if (!def) throw new Error(`منصة غير معروفة: ${input.provider}`);
  const mode = input.credentials && Object.keys(input.credentials).length > 0 ? "LIVE" : resolveMode(def);
  const conn = await prisma.socialConnection.upsert({
    where: { provider: input.provider },
    create: {
      provider: input.provider,
      displayName: def.label,
      mode,
      enabled: input.enabled ?? true,
      handle: input.handle ?? `${def.handlePrefix}taiznow`,
      accountName: input.accountName ?? "تعز الآن",
      credentials: (input.credentials ?? undefined) as object | undefined,
    },
    update: {
      mode,
      enabled: input.enabled ?? true,
      handle: input.handle ?? undefined,
      accountName: input.accountName ?? undefined,
      credentials: (input.credentials ?? undefined) as object | undefined,
    },
  });
  await prisma.platformIdentity.update({
    where: { provider: input.provider },
    data: { handle: input.handle ?? `${def.handlePrefix}taiznow`, connected: true, linkedVia: mode === "LIVE" ? "credentials" : "mock" },
  });
  return conn;
}

/**
 * Simulate the "connect with Google" flow: link the platform's own Google
 * account and the Google-owned channels (YouTube) so they can be managed from
 * one place. Real OAuth can replace this when credentials are supplied.
 */
export async function linkGoogleAccount(input: { email: string; handle?: string }) {
  await prisma.platformIdentity.upsert({
    where: { provider: "google" },
    create: { provider: "google", email: input.email, handle: input.handle ?? "taiznow", connected: true, linkedVia: "google" },
    update: { email: input.email, handle: input.handle ?? "taiznow", connected: true, linkedVia: "google" },
  });
  for (const provider of GOOGLE_LINKED_PROVIDERS) {
    if (provider === "google") continue;
    const def = PROVIDER_MAP.get(provider);
    if (!def) continue;
    await prisma.socialConnection.upsert({
      where: { provider },
      create: {
        provider,
        displayName: def.label,
        mode: resolveMode(def),
        enabled: true,
        handle: `${def.handlePrefix}taiznow`,
        accountName: "تعز الآن",
      },
      update: {},
    });
    await prisma.platformIdentity.update({
      where: { provider },
      data: { connected: true, linkedVia: "google", handle: `${def.handlePrefix}taiznow` },
    });
  }
  return prisma.platformIdentity.findMany({ where: { connected: true } });
}

/** Publish one content item to every enabled, available channel. */
export async function publishContent(contentItemId: string): Promise<{ outcomes: PublishOutcome[]; drafts: { platform: string; body: string }[] }> {
  const item = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    include: { socialPosts: true, evidence: { include: { source: true } } },
  });
  if (!item) throw new Error("المحتوى غير موجود");

  const url = `${baseUrl()}/news/${item.slug}`;
  const drafts = draftSocialPosts({
    title: item.title,
    summary: item.summary,
    confidence: item.confidence,
    verdictLabel: VERDICT_LABELS[item.verdict] ?? "",
    slug: item.slug,
    baseUrl: baseUrl(),
  });

  const byPlatform = new Map(drafts.map((d) => [d.platform, d.body]));
  const connections = await prisma.socialConnection.findMany({ where: { enabled: true } });
  const outcomes: PublishOutcome[] = [];

  for (const conn of connections) {
    const def = PROVIDER_MAP.get(conn.provider);
    if (!def) continue;
    const body = byPlatform.get(conn.provider) ?? `${item.title}\n\n${item.summary}\n${url}`;
    const result = await deliver({ provider: conn.provider, handle: conn.handle, body, url });
    outcomes.push({ provider: conn.provider, label: conn.displayName, ok: result.ok, mode: result.mode, detail: result.detail });

    await prisma.socialPost.create({
      data: {
        platform: conn.provider,
        body,
        status: result.ok ? "published" : "failed",
        publishedAt: result.ok ? new Date() : null,
        contentItemId: item.id,
      },
    });
    await prisma.socialConnection.update({
      where: { id: conn.id },
      data: {
        lastPostedAt: result.ok ? new Date() : conn.lastPostedAt,
        postCount: result.ok ? { increment: 1 } : undefined,
        errorCount: result.ok ? undefined : { increment: 1 },
      },
    });
  }

  return { outcomes, drafts };
}

/** Publish a free-form post (e.g. a rebuttal) to every enabled channel. */
export async function publishText(input: { title: string; body: string; url?: string }): Promise<PublishOutcome[]> {
  const connections = await prisma.socialConnection.findMany({ where: { enabled: true } });
  const outcomes: PublishOutcome[] = [];
  for (const conn of connections) {
    const result = await deliver({ provider: conn.provider, handle: conn.handle, body: `${input.title}\n\n${input.body}`, url: input.url });
    outcomes.push({ provider: conn.provider, label: conn.displayName, ok: result.ok, mode: result.mode, detail: result.detail });
    await prisma.socialConnection.update({
      where: { id: conn.id },
      data: {
        lastPostedAt: result.ok ? new Date() : conn.lastPostedAt,
        postCount: result.ok ? { increment: 1 } : undefined,
        errorCount: result.ok ? undefined : { increment: 1 },
      },
    });
  }
  return outcomes;
}

export { providerEnvPresent };
