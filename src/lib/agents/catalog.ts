import type { AgentKind } from "@prisma/client";

/**
 * The platform's AI agent catalog. Each entry is seeded into the database and
 * executed by the autopilot runtime. Agents never publish unverified content
 * and never invent evidence; they operate strictly on stored data.
 */
export type AgentDef = {
  slug: string;
  name: string;
  role: string;
  kind: AgentKind;
  description: string;
  capabilities: string[];
};

export const AGENT_CATALOG: AgentDef[] = [
  {
    slug: "collector",
    name: "الجامع",
    role: "جامع المصادر والأخبار",
    kind: "COLLECTOR",
    description:
      "يجمع الأخبار والادعاءات الجديدة من المصادر العامة والروس (Google News وغيرها) ويدخلها كبلاغات قابلة للتحقق.",
    capabilities: [
      "سحب الأخبار من خلاصات RSS/Atom العامة مجاناً",
      "إزالة التكرار قبل الإدخال",
      "تسجيل رابط المصدر وأصله لكل بلاغ",
    ],
  },
  {
    slug: "monitor",
    name: "الراصد",
    role: "راصد المصادر والبلاغات",
    kind: "MONITOR",
    description:
      "يراقب البلاغات والمحتوى الجديد باستمرار، يرتّب الأولويات، ويجهّز كل عنصر للمرحلة التالية.",
    capabilities: [
      "فرز البلاغات الجديدة ورفع أولوية العاجل",
      "متابعة المحتوى المعلّق وتحويله لقيد المراجعة",
      "تنبيه الفريق للعناصر التي تحتاج انتباهاً",
    ],
  },
  {
    slug: "verifier",
    name: "المدقّق",
    role: "مدقق الحقائق",
    kind: "VERIFIER",
    description:
      "يشغّل محرك التحليل على الادعاءات والوسائط، يحسب درجة الثقة بالأوزان الموثّقة، ويسجّل النتائج دون اختلاق أدلة.",
    capabilities: [
      "تحليل الادعاءات واستخراج إشارات التحذير",
      "تحليل الصور/الفيديو (بيانات وصفية، توليد AI، تزييف عميق)",
      "احتساب درجة الثقة وتثبيتها على المحتوى",
    ],
  },
  {
    slug: "writer",
    name: "الصائغ",
    role: "الصائغ الاحترافي",
    kind: "WRITER",
    description:
      "يصوغ الأخبار الموثّقة بأسلوب صحفي احترافي عربي، ويكتب صيغة الردّ على الشائعات، ونصوص النشر لكل منصة.",
    capabilities: [
      "إعادة صياغة الخبر الموثّق باحترافية",
      "كتابة بيان تفنيد للخبر الكاذب بالأدلة",
      "توليد نصوص مناسبة لكل وسيلة تواصل",
    ],
  },
  {
    slug: "publisher",
    name: "الناشر",
    role: "الناشر في وسائل التواصل",
    kind: "PUBLISHER",
    description:
      "ينشر المحتوى الموثّق المنشور تلقائياً على كل القنوات المفعّلة المتاحة (مسموعة ومرئية ومكتوبة).",
    capabilities: [
      "النشر المتعدد على كل القنوات المفعّلة",
      "تتبّع حالة كل منشور وأرشفته",
      "إعادة المحاولة عند تعذّر قناة",
    ],
  },
  {
    slug: "responder",
    name: "المفنّد",
    role: "الردّ على الأخبار الكاذبة",
    kind: "RESPONDER",
    description:
      "يرصد الشائعات المدحوضة ويصدر ردوداً مهذّبة مدعومة بالأدلة ويوزّعها على القنوات، من أي حساب كانت الشائعة.",
    capabilities: [
      "رصد الشائعات المدحوضة (verdict = false)",
      "صياغة ردّ رسميّ مهذّب بالأدلة",
      "توزيع الردّ على القنوات المتاحة",
    ],
  },
];

export const AGENT_KIND_LABELS: Record<AgentKind, string> = {
  COLLECTOR: "جمع",
  MONITOR: "رصد",
  VERIFIER: "تحقق",
  WRITER: "صياغة",
  PUBLISHER: "نشر",
  RESPONDER: "تفنيد",
};
