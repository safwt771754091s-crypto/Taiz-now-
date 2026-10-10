import { prisma } from "@/lib/prisma";
import { analyzeClaim, analysisFromMedia } from "@/lib/ai";
import { score } from "@/lib/confidence";
import { writeProfessionally, draftRebuttal } from "@/lib/writer";
import { publishContent, publishText } from "@/lib/social/connect";
import { slugify } from "@/lib/slug";
import { AGENT_CATALOG } from "./catalog";
import { yemenFeeds, collectFeed } from "./sources";
import { ensureSystemPages, checkPageIntegrity } from "@/lib/platform/pages";
import { ensurePlatformEmails } from "@/lib/platform/email";
import { getBrand } from "@/lib/platform/brand";
import { runIntegrityScan, detectDrift } from "@/lib/security/config";
import { recordSecurityEvent } from "@/lib/security/events";

export type AgentTickResult = {
  agent: string;
  slug: string;
  ok: boolean;
  summary: string;
  detail?: Record<string, unknown>;
};

async function record(agentId: string, slug: string, action: string, result: AgentTickResult) {
  await prisma.agentRun.create({
    data: {
      agentId,
      action,
      status: result.ok ? "ok" : "error",
      summary: result.summary,
      detail: (result.detail ?? undefined) as object | undefined,
    },
  });
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      lastRunAt: new Date(),
      runCount: { increment: 1 },
      errorCount: result.ok ? undefined : { increment: 1 },
    },
  });
}

/** COLLECTOR — pull fresh items from public feeds into the report queue. */
async function runCollector(): Promise<AgentTickResult> {
  const feeds = yemenFeeds().slice(0, Number(process.env.COLLECTOR_MAX_FEEDS || 5));
  const sinceHours = Number(process.env.COLLECTOR_SINCE_HOURS || 72);
  const cutoff = Date.now() - sinceHours * 3600_000;
  let collected = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const feed of feeds) {
    try {
      const items = await collectFeed(feed.url, feed.label);
      for (const item of items.slice(0, 10)) {
        if (!item.link || !item.title) continue;
        const published = item.publishedAt ? Date.parse(item.publishedAt) : NaN;
        if (Number.isFinite(published) && published < cutoff) {
          skipped++;
          continue;
        }
        const existing = await prisma.report.findFirst({ where: { sourceUrl: item.link } });
        if (existing) {
          skipped++;
          continue;
        }
        await prisma.report.create({
          data: {
            type: "NEWS",
            title: item.title.slice(0, 180),
            description: (item.summary || item.title).slice(0, 4000),
            sourceUrl: item.link,
            origin: feed.label,
            anonymous: false,
            priority: 1,
          },
        });
        collected++;
      }
    } catch (err) {
      errors.push(`${feed.label}: ${(err as Error).message}`);
    }
  }

  return {
    ok: errors.length < feeds.length,
    agent: "الجامع",
    slug: "collector",
    summary:
      collected > 0
        ? `جمع ${collected} عنصراً جديداً من ${feeds.length} مصدر (تجاهل ${skipped} مكرر/قديم).`
        : `لا عناصر جديدة (فحص ${feeds.length} مصدر، تجاهل ${skipped}).`,
    detail: { collected, skipped, feeds: feeds.length, errors },
  };
}

/** MONITOR — triage new reports and surface stuck content. */
async function runMonitor(): Promise<AgentTickResult> {
  const pending = await prisma.report.findMany({ where: { status: "PENDING" }, take: 25 });
  let triaged = 0;
  for (const r of pending) {
    const urgent = /(عاجل|انفجار|قتل|غارة|كارثة|سقوط)/.test(`${r.title} ${r.description}`);
    const priority = Math.min(9, (r.priority ?? 0) + (urgent ? 3 : 1));
    await prisma.report.update({
      where: { id: r.id },
      data: { status: "UNDER_REVIEW", priority: urgent ? Math.max(priority, 5) : priority },
    });
    triaged++;
  }
  return {
    ok: true,
    agent: "الراصد",
    slug: "monitor",
    summary: triaged > 0 ? `فرز ${triaged} بلاغاً جديداً.` : "لا بلاغات جديدة تستدعي الفرز.",
    detail: { triaged },
  };
}

/** VERIFIER — score published-but-unscored content and analyze pending media. */
async function runVerifier(): Promise<AgentTickResult> {
  const candidates = await prisma.contentItem.findMany({
    where: { confidence: 0, status: { in: ["VERIFIED", "PUBLISHED", "IN_REVIEW"] } },
    take: 10,
    include: { evidence: { include: { source: true } } },
  });
  let scored = 0;
  let falseCount = 0;
  for (const item of candidates) {
    const analysis = await analyzeClaim({
      claim: item.claim || item.title,
      evidenceText: item.evidence.map((e) => e.title).join("\n"),
    });
    const result = score(analysis.suggestedSignals);
    await prisma.confidenceRecord.create({
      data: {
        entityType: "ContentItem",
        entityId: item.id,
        contentItemId: item.id,
        sourceScore: analysis.suggestedSignals.source,
        contentScore: analysis.suggestedSignals.content,
        imageScore: analysis.suggestedSignals.image,
        videoScore: analysis.suggestedSignals.video,
        contextScore: analysis.suggestedSignals.context,
        humanScore: analysis.suggestedSignals.human,
        total: result.total,
        verdict: result.verdict,
        breakdown: { ...result, reasoning: analysis.reasoning, agent: "verifier" },
      },
    });
    await prisma.contentItem.update({
      where: { id: item.id },
      data: { confidence: result.total, verdict: result.verdict },
    });
    scored++;
    if (result.verdict === "FALSE") falseCount++;
  }

  // Analyze media assets that have not been analyzed yet.
  const media = await prisma.mediaAsset.findMany({ where: { status: "PENDING" }, take: 10 });
  let analyzedMedia = 0;
  for (const m of media) {
    const kind = m.kind === "VIDEO" ? "video" : "image";
    const res = analysisFromMedia(kind, (m.metadata ?? null) as Record<string, unknown> | null);
    await prisma.mediaAsset.update({
      where: { id: m.id },
      data: {
        aiGeneratedProbability: res.aiGeneratedProbability,
        deepfakeProbability: res.deepfakeProbability,
        analysisNotes: [...res.findings, ...res.flags].join("\n"),
        status: "ANALYZED",
      },
    });
    analyzedMedia++;
  }

  return {
    ok: true,
    agent: "المدقّق",
    slug: "verifier",
    summary: `دقّق ${scored} عنصراً وحلّل ${analyzedMedia} وسائط${falseCount ? ` — رصد ${falseCount} خبراً كاذباً` : ""}.`,
    detail: { scored, analyzedMedia, falseCount },
  };
}

/** WRITER — polish verified items that have not yet been professionally phrased. */
async function runWriter(): Promise<AgentTickResult> {
  const items = await prisma.contentItem.findMany({
    where: { status: { in: ["VERIFIED", "PUBLISHED"] }, NOT: { tags: { has: "agent-written" } } },
    take: 5,
  });
  let written = 0;
  for (const item of items) {
    const piece = await writeProfessionally({
      title: item.title,
      summary: item.summary,
      body: item.body,
      verdictLabel: item.verdict,
      confidence: item.confidence,
      location: item.location,
    });
    await prisma.contentItem.update({
      where: { id: item.id },
      data: { body: piece.body, tags: Array.from(new Set([...item.tags, "agent-written"])) },
    });
    written++;
  }
  return {
    ok: true,
    agent: "الصائغ",
    slug: "writer",
    summary: written > 0 ? `صاغ ${written} خبراً بأسلوب احترافي.` : "لا محتوى بانتظار الصياغة.",
    detail: { written },
  };
}

/** PUBLISHER — distribute published content to all enabled channels. */
async function runPublisher(): Promise<AgentTickResult> {
  const items = await prisma.contentItem.findMany({
    where: { status: "PUBLISHED", socialPosts: { none: { status: "published" } } },
    take: 5,
  });
  let distributed = 0;
  let channels = 0;
  for (const item of items) {
    const { outcomes } = await publishContent(item.id);
    channels += outcomes.filter((o) => o.ok).length;
    distributed++;
  }
  return {
    ok: true,
    agent: "الناشر",
    slug: "publisher",
    summary: distributed > 0 ? `نشر ${distributed} خبراً على ${channels} قناة.` : "لا محتوى جديد للنشر.",
    detail: { distributed, channels },
  };
}

/** RESPONDER — publish polite, evidence-backed rebuttals of false content. */
async function runResponder(): Promise<AgentTickResult> {
  const targets = await prisma.contentItem.findMany({
    where: {
      kind: "RUMOR",
      verdict: "FALSE",
      NOT: { tags: { has: "agent-responded" } },
    },
    take: 5,
    include: { evidence: { include: { source: true } } },
  });
  let responses = 0;
  let channels = 0;
  for (const item of targets) {
    const rebuttal = await draftRebuttal({
      title: item.title,
      summary: item.summary,
      verdictLabel: item.verdict,
      confidence: item.confidence,
      sources: item.evidence.map((e) => e.title),
    });
    const outcomes = await publishText({ title: rebuttal.headline, body: rebuttal.body });
    channels += outcomes.filter((o) => o.ok).length;
    await prisma.contentItem.update({
      where: { id: item.id },
      data: { tags: Array.from(new Set([...item.tags.filter((t) => t !== "agent-responded"), "agent-responded"])) },
    });
    responses++;
  }
  return {
    ok: true,
    agent: "المفنّد",
    slug: "responder",
    summary: responses > 0 ? `أصدر ${responses} ردّاً على ${channels} قناة.` : "لا شائعات كاذبة بانتظار الرد.",
    detail: { responses, channels },
  };
}

/**
 * GUARDIAN — the platform's own caretaker. It (1) registers and re-syncs
 * every page, (2) reconciles the platform email identity, and (3) scans for
 * unauthorised changes to settings, brand, pages and channels. It never
 * invents pages; it records and protects what the platform actually has.
 */
async function runGuardian(): Promise<AgentTickResult> {
  // 1. Pages: register the code-known routes and detect any that drifted.
  const registered = await ensureSystemPages();
  const pageReport = await checkPageIntegrity(null);

  // 2. Email identity: make sure the platform mailboxes exist and sync Google.
  const brand = await getBrand();
  await ensurePlatformEmails(brand.name);
  const emailCount = await prisma.platformEmailAccount.count();

  // 3. Settings drift: compare to the last approved baseline.
  const drift = await detectDrift();

  // 4. Security sweep: surface unresolved high-severity events for the log.
  const openHigh = await prisma.securityEvent.count({
    where: { resolved: false, severity: { in: ["HIGH", "CRITICAL"] } },
  });

  const summary =
    `زامن ${registered} صفحة، ${emailCount} بريد، ` +
    (drift.drifted ? `ورصد انحرافاً في الإعدادات (${drift.differences.length} فرق).` : "ولم يرصد أي انحراف في الإعدادات.");

  return {
    ok: true,
    agent: "الحارس",
    slug: "guardian",
    summary,
    detail: {
      pagesRegistered: registered,
      pagesTotal: pageReport.total,
      missingSystemPages: pageReport.missingSystem,
      emails: emailCount,
      drift: drift.drifted,
      differences: drift.differences,
      baseline: drift.baselineHash,
      openHighSeverity: openHigh,
    },
  };
}

const RUNNERS: Record<string, () => Promise<AgentTickResult>> = {
  guardian: runGuardian,
  collector: runCollector,
  monitor: runMonitor,
  verifier: runVerifier,
  writer: runWriter,
  publisher: runPublisher,
  responder: runResponder,
};

const ACTION_FOR: Record<string, string> = {
  guardian: "guard",
  collector: "collect",
  monitor: "triage",
  verifier: "verify",
  writer: "write",
  publisher: "publish",
  responder: "respond",
};

/** Execute one agent by slug (or id). Returns a structured tick result. */
export async function runAgent(slugOrId: string): Promise<AgentTickResult | null> {
  const agent = await prisma.agent.findFirst({
    where: { OR: [{ slug: slugOrId }, { id: slugOrId }] },
  });
  if (!agent) return null;

  const runner = RUNNERS[agent.slug];
  if (!runner) {
    const result: AgentTickResult = { ok: false, agent: agent.name, slug: agent.slug, summary: "لا يوجد منفّذ لهذا الوكيل." };
    await record(agent.id, agent.slug, "run", result);
    return result;
  }

  let result: AgentTickResult;
  try {
    result = await runner();
  } catch (err) {
    result = { ok: false, agent: agent.name, slug: agent.slug, summary: `خطأ: ${(err as Error).message}` };
  }
  await record(agent.id, agent.slug, ACTION_FOR[agent.slug] ?? "run", result);
  return result;
}

/** Run every ENABLED agent once (the autopilot tick), in pipeline order. */
export async function runAutopilot(): Promise<AgentTickResult[]> {
  const agents = await prisma.agent.findMany({ where: { status: "ENABLED" } });
  const order = AGENT_CATALOG.map((d) => d.slug);
  agents.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
  const results: AgentTickResult[] = [];
  for (const agent of agents) {
    const res = await runAgent(agent.slug);
    if (res) results.push(res);
  }
  return results;
}

/** Ensure the agent catalog exists in the database (idempotent). */
export async function ensureAgents(): Promise<void> {
  for (const def of AGENT_CATALOG) {
    await prisma.agent.upsert({
      where: { slug: def.slug },
      create: {
        slug: def.slug,
        name: def.name,
        role: def.role,
        kind: def.kind,
        description: def.description,
        config: { capabilities: def.capabilities },
      },
      update: { name: def.name, role: def.role, kind: def.kind, description: def.description, config: { capabilities: def.capabilities } },
    });
  }
}

export { slugify };
