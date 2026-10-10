import type { ConfidenceSignals } from "./confidence";

/**
 * AI layer. When OPENAI_API_KEY is present we call the model; otherwise we fall
 * back to a deterministic, rule-based analyser so the platform always works
 * offline and in CI. Nothing here is presented to the public as human-verified —
 * AI output is advisory input to a human reviewer.
 */

export const AI_ENABLED = Boolean(process.env.OPENAI_API_KEY);

export type ClaimAnalysis = {
  aiGenerated: boolean;
  model: string;
  verdictHint: "TRUE" | "MOSTLY_TRUE" | "MISLEADING" | "SUSPICIOUS" | "FALSE" | "UNVERIFIED";
  suggestedSignals: ConfidenceSignals;
  reasoning: string;
  checklist: string[];
  redFlags: string[];
};

const CHECKLIST_BASE = [
  "هل المصدر أصلي ومعروف؟",
  "هل يوجد تاريخ ومكان واضح للمحتوى؟",
  "هل الصورة/الفيديو مطابق للمكان والزمان المزعوم؟",
  "هل توجد منظمات أو مصادر مستقلة تؤكد الادعاء؟",
  "هل يمكن عكس البحث للعثور على نسخة أقدم؟",
];

function offlineHeuristics(input: { claim: string; evidenceText?: string; sourceReliability?: number }) {
  const text = `${input.claim} ${input.evidenceText ?? ""}`.toLowerCase();
  const redFlags: string[] = [];
  if (/(عاجل|حصري|انتشر|يقولون|مصدر موثوق|بدون دليل|شاهد|فظيع)/.test(input.claim)) {
    redFlags.push("صياغة عاطفية أو إثارة بدون دليل مرفق");
  }
  if (/(انفجار|قتل|كارثة|سقوط|غارة)/.test(text) && !input.evidenceText) {
    redFlags.push("ادعاء خطير دون أدلة مرفقة");
  }
  if (/(صورة|فيديو|مقطع)/.test(text) && !(input.evidenceText ?? "").length) {
    redFlags.push("وسائط مذكورة بدون بيانات وصفية أو مصدر");
  }
  const reliability = input.sourceReliability ?? 40;
  const evidenceBonus = input.evidenceText && input.evidenceText.trim().length > 40 ? 25 : 0;
  const contentScore = Math.min(100, 30 + evidenceBonus);
  const sourceScore = Math.min(100, Math.max(0, reliability));
  const verdictHint: ClaimAnalysis["verdictHint"] =
    redFlags.length === 0 && reliability >= 70
      ? "MOSTLY_TRUE"
      : redFlags.length >= 2
        ? "SUSPICIOUS"
        : "UNVERIFIED";
  return {
    redFlags,
    sourceScore,
    contentScore,
    verdictHint,
  };
}

/** Coerce loosely-typed model JSON into our shape, tolerating missing fields. */
function normaliseSignals(raw: unknown): ConfidenceSignals {
  const s = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown, fallback = 0) => {
    const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
  };
  return {
    source: num(s.source, 50),
    content: num(s.content, 50),
    image: num(s.image, 50),
    video: num(s.video, 50),
    context: num(s.context, 50),
    human: num(s.human, 0),
  };
}

export async function analyzeClaim(input: {
  claim: string;
  evidenceText?: string;
  sourceReliability?: number;
}): Promise<ClaimAnalysis> {
  const heur = offlineHeuristics(input);
  if (!AI_ENABLED) {
    return {
      aiGenerated: false,
      model: "offline-heuristics",
      verdictHint: heur.verdictHint,
      suggestedSignals: {
        source: heur.sourceScore,
        content: heur.contentScore,
        image: 0,
        video: 0,
        context: 40,
        human: 0,
      },
      reasoning:
        "تم التحليل بالمحرك المحلي القائم على القواعد (لا يوجد مفتاح ذكاء اصطناعي مهيأ). النتيجة استرشادية ويجب تدقيقها بشرياً.",
      checklist: CHECKLIST_BASE,
      redFlags: heur.redFlags,
    };
  }

  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const system = `أنت مساعد تحقق من المعلومات لمنصة إخبارية يمنية.
مهمتك تقييم الادعاءات بموضوعية ولا تختلق أدلة. أعد JSON فقط بالمفاتيح:
verdictHint (TRUE|MOSTLY_TRUE|MISLEADING|SUSPICIOUS|FALSE|UNVERIFIED),
suggestedSignals {source,content,image,video,context,human} قيم من 0 إلى 100,
reasoning (شرح قصير), checklist (خطوات تحقق), redFlags (قائمة إشارات تحذيرية).`;

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `الادعاء: ${input.claim}\n\nالأدلة/الملاحظات:\n${input.evidenceText ?? "لا توجد"}\n\nموثوقية المصدر المقدرة: ${input.sourceReliability ?? 50}/100`,
        },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return {
      aiGenerated: true,
      model,
      verdictHint: parsed.verdictHint ?? heur.verdictHint,
      suggestedSignals: normaliseSignals(parsed.suggestedSignals),
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : heur.verdictHint,
      checklist: Array.isArray(parsed.checklist) && parsed.checklist.length ? parsed.checklist : CHECKLIST_BASE,
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : heur.redFlags,
    };
  } catch (err) {
    return {
      aiGenerated: false,
      model: "offline-heuristics(fallback)",
      verdictHint: heur.verdictHint,
      suggestedSignals: { source: heur.sourceScore, content: heur.contentScore, image: 0, video: 0, context: 40, human: 0 },
      reasoning: `تعذر الوصول إلى خدمة الذكاء الاصطناعي (${(err as Error).message}). تم استخدام المحرك المحلي.`,
      checklist: CHECKLIST_BASE,
      redFlags: heur.redFlags,
    };
  }
}

export type MediaAnalysis = {
  kind: "image" | "video";
  aiGeneratedProbability: number;
  deepfakeProbability: number | null;
  findings: string[];
  flags: string[];
  model: string;
};

/** Deterministic metadata-driven analysis used when no AI key/vision is available. */
export function analyzeMetadata(
  kind: "image" | "video",
  meta: Record<string, unknown> | null | undefined,
): MediaAnalysis {
  const findings: string[] = [];
  const flags: string[] = [];
  let aiProb = 0.5;

  if (!meta || Object.keys(meta).length === 0) {
    flags.push("لا توجد بيانات وصفية (EXIF) — مصدر محتمل من منصة تواصل اجتماعي");
    aiProb = 0.55;
  } else {
    const software = String(meta.Software ?? meta.software ?? meta.CreatorTool ?? "");
    const make = meta.Make ?? meta.make;
    const model = meta.Model ?? meta.model;
    if (software) {
      findings.push(`برنامج التحرير/التوليد: ${software}`);
      if (/(midjourney|dall|stable diffusion|firefly|imagen|sora|generative|ai)/i.test(software)) {
        aiProb = 0.9;
        flags.push("اسم البرنامج يشير إلى توليد بالذكاء الاصطناعي");
      }
    }
    if (make || model) {
      findings.push(`جهاز الالتقاط: ${[make, model].filter(Boolean).join(" ")}`);
      aiProb = Math.min(aiProb, 0.35);
    }
    if (meta.DateTimeOriginal || meta.CreateDate || meta.ModifyDate) {
      findings.push(
        `تاريخ الالتقاط/التعديل: ${String(meta.DateTimeOriginal ?? meta.CreateDate ?? meta.ModifyDate)}`,
      );
    }
    if (meta.GPSLatitude || meta.latitude) {
      findings.push("يوجد بيانات GPS — يمكن التحقق الجغرافي");
    } else {
      flags.push("لا توجد بيانات GPS مضمّنة");
    }
    if (!make && !model) {
      flags.push("لا يوجد جهاز التقاط معروف");
    }
  }

  return {
    kind,
    aiGeneratedProbability: Number(aiProb.toFixed(2)),
    deepfakeProbability: kind === "video" ? 0.5 : null,
    findings,
    flags,
    model: "offline-metadata",
  };
}

/**
 * Full media analysis combining metadata heuristics with terse reporting.
 * No external vision model is required; findings are advisory.
 */
export function analysisFromMedia(
  kind: "image" | "video",
  meta: Record<string, unknown> | null | undefined,
): MediaAnalysis {
  const base = analyzeMetadata(kind, meta);
  const findings = [...base.findings];
  const flags = [...base.flags];
  const software = String(meta?.Software ?? meta?.software ?? "");
  const hasGeo = Boolean(meta?.GPSLatitude || meta?.latitude || meta?.gpsLat || meta?.location);
  const captured = Boolean(meta?.DateTimeOriginal || meta?.CreateDate);

  if (!captured) flags.push("لا يوجد تاريخ التقاط — يصعب التحقق الزمني");
  if (kind === "video" && base.deepfakeProbability !== null) {
    if (/(deepfake|face swap|synthesia|heygen)/i.test(software)) {
      flags.push("مؤشرات على معالجة صوت/وجه اصطناعية");
    } else {
      findings.push("لم تُرصد مؤشرات واضحة على التزييف العميق في البيانات الوصفية");
    }
  }
  if (hasGeo) findings.push("المكان قابل للتحقق جغرافياً من البيانات الوصفية");

  return { ...base, findings, flags, model: "offline-media" };
}

/** Generate ready-to-publish social posts for each platform from a content item. */
export function draftSocialPosts(input: {
  title: string;
  summary: string;
  confidence: number;
  verdictLabel: string;
  slug: string;
  baseUrl?: string;
}): { platform: string; body: string }[] {
  const publicBase =
    process.env.PLATFORM_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "https://taiznow.ye";
  const url = `${input.baseUrl?.replace(/\/$/, "") ?? publicBase}/news/${input.slug}`;
  const tag = "#اليمن #تعز #التحقق_الذكي";
  const lead = `${input.title}\n\n${input.summary}`;
  const trust = `درجة الثقة: ${input.confidence}/100 (${input.verdictLabel})`;
  return [
    { platform: "website", body: `${lead}\n\n${trust}\n${url}` },
    { platform: "facebook", body: `${lead}\n\n${trust}\n🔗 ${url}\n${tag}` },
    { platform: "x", body: `${input.title}\n\n${trust}\n🔗 ${url}\n${tag}` },
    { platform: "telegram", body: `📌 ${input.title}\n\n${input.summary}\n\n${trust}\n${url}` },
    { platform: "instagram", body: `${input.title}\n\n${trust}\n${tag}` },
  ];
}
