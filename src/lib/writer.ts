import { AI_ENABLED } from "./ai";

/**
 * Professional Arabic writer. Uses OpenAI when configured, otherwise a robust
 * template-based editorial engine so the platform always produces clean,
 * publication-ready Arabic without inventing facts.
 */

export type WriterContext = {
  title: string;
  summary: string;
  body?: string;
  verdictLabel: string;
  confidence: number;
  sources?: string[];
  location?: string | null;
  url?: string;
};

export type WrittenPiece = {
  aiGenerated: boolean;
  model: string;
  headline: string;
  body: string;
};

const DISCLAIMER = "منصة تعز الآن — نتحقق قبل أن ننشر. القرار النهائي للتحقق البشري.";

function sourcesLine(sources?: string[]) {
  if (!sources || sources.length === 0) return "";
  return `\n\nالمصادر والأدلة: ${sources.join(" · ")}`;
}

function offlineProfessional(ctx: WriterContext): WrittenPiece {
  const loc = ctx.location ? ` (${ctx.location})` : "";
  const body = [
    `${ctx.title}`,
    "",
    `${ctx.summary}`,
    "",
    ctx.body ? `${ctx.body}\n` : "",
    `خلاصة التحقق: صُنّف الخبر بدرجة ثقة ${ctx.confidence}/100 (${ctx.verdictLabel}).${loc}`,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    aiGenerated: false,
    model: "offline-editorial",
    headline: ctx.title,
    body: `${body}${sourcesLine(ctx.sources)}\n\n_${DISCLAIMER}_`,
  };
}

function offlineRebuttal(ctx: WriterContext): WrittenPiece {
  const headline = `بيان تفنيد: ${ctx.title}`;
  const body = [
    headline,
    "",
    `تداولت بعض الحسابات والوسائط ادعاءً مفاده: «${ctx.title}».`,
    "",
    "بعد التحقق المعتمد على الأدلة، تبيّن أن هذا الادعاء غير صحيح. الأسباب:",
    `• التقييم الفني: حُدّدت درجة ثقة ${ctx.confidence}/100 (${ctx.verdictLabel}).`,
    "• لا توجد أدلة موثوقة تدعم الادعاء كما رُوِّج له.",
    "• بعض المصادر المتداولة غير معروفة أو تعذّر التحقق من أصالتها.",
    "",
    "نهيب بالجميع عدم تداول الأخبار دون التحقق من مصادرها، ومراجعتنا للتحقق من أي ادعاء قبل نشره.",
    "",
    `_${DISCLAIMER}_`,
  ].join("\n");
  return { aiGenerated: false, model: "offline-editorial", headline, body };
}

async function callModel(system: string, user: string): Promise<{ headline: string; body: string } | null> {
  if (!AI_ENABLED) return null;
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    if (typeof parsed.body === "string" && parsed.body.trim()) {
      return { headline: parsed.headline ?? "", body: parsed.body };
    }
    return null;
  } catch {
    return null;
  }
}

/** Rewrite a verified item into a polished, professional Arabic news piece. */
export async function writeProfessionally(ctx: WriterContext): Promise<WrittenPiece> {
  const system = `أنت محرر صحفي عربي محترف في منصة تحقق يمنية.
أعد كتابة الخبر الموثّق بأسلوب صحفي مهني واضح ومحايد، دون أي إضافة أو تخمين لوقائع غير مذكورة، ودون اختلاق مصادر.
أعد JSON فقط بالمفاتيح: headline (عنوان احترافي)، body (النص الكامل بصياغة صحفية).`;
  const user = `العنوان: ${ctx.title}\nالملخص: ${ctx.summary}\nالنص الخام: ${ctx.body ?? "لا يوجد"}\nدرجة الثقة: ${ctx.confidence}/100 (${ctx.verdictLabel})\nالمصادر: ${ctx.sources?.join(", ") ?? "غير مذكورة"}\nالمكان: ${ctx.location ?? "غير محدد"}`;
  const out = await callModel(system, user);
  if (out) {
    return { aiGenerated: true, model: process.env.OPENAI_MODEL || "gpt-4o-mini", headline: out.headline || ctx.title, body: out.body };
  }
  return offlineProfessional(ctx);
}

/** Write a firm but polite public rebuttal of a false claim, grounded in evidence. */
export async function draftRebuttal(ctx: WriterContext): Promise<WrittenPiece> {
  const system = `أنت المسؤول الإعلامي في منصة تحقق يمنية.
اكتب بيان تفنيد رسمي مهذّب وواضح لخبر كاذب، مدعوم بالأدلة المذكورة فقط، بنبرة واثقة غير عدائية.
أعد JSON فقط بالمفاتيح: headline، body.`;
  const user = `الادعاء الكاذب: ${ctx.title}\nالملخص: ${ctx.summary}\nدرجة الثقة: ${ctx.confidence}/100 (${ctx.verdictLabel})\nالأدلة: ${ctx.sources?.join(", ") ?? "لا توجد"}`;
  const out = await callModel(system, user);
  if (out) {
    return { aiGenerated: true, model: process.env.OPENAI_MODEL || "gpt-4o-mini", headline: out.headline || `بيان تفنيد: ${ctx.title}`, body: out.body };
  }
  return offlineRebuttal(ctx);
}
