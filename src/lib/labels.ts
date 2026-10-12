import type { ContentKind, ContentStatus, ReportStatus, ReportType, Verdict } from "@prisma/client";

export const VERDICT_LABELS: Record<Verdict, string> = {
  TRUE: "صحيح",
  MOSTLY_TRUE: "صحيح",
  MISLEADING: "صحيح غالباً",
  SUSPICIOUS: "مشبوه",
  FALSE: "غير صحيح",
  UNVERIFIED: "غير متحقق",
};

/** Short band labels aligned to the documented 5-band scale. */
export const BAND_LABELS: Record<string, string> = {
  verified: "موثق",
  true: "صحيح",
  likely: "صحيح غالباً",
  suspicious: "مشبوه",
  false: "غير صحيح",
};

/** Tailwind class fragments per verdict (used for badges) — tuned for the light theme. */
export const VERDICT_STYLES: Record<Verdict, string> = {
  TRUE: "bg-emerald-50 text-emerald-800 border-emerald-300",
  MOSTLY_TRUE: "bg-teal-50 text-teal-800 border-teal-300",
  MISLEADING: "bg-amber-50 text-amber-800 border-amber-300",
  SUSPICIOUS: "bg-orange-50 text-orange-800 border-orange-300",
  FALSE: "bg-rose-50 text-rose-800 border-rose-300",
  UNVERIFIED: "bg-slate-100 text-slate-700 border-slate-300",
};

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  NEWS: "خبر",
  RUMOR: "شائعة",
  CORRECTION: "تصحيح",
};

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: "مسودة",
  IN_REVIEW: "قيد المراجعة",
  VERIFIED: "موثق",
  PUBLISHED: "منشور",
  REJECTED: "مرفوض",
  RETRACTED: "مسحوب",
};

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  NEWS: "خبر",
  IMAGE: "صورة",
  VIDEO: "فيديو",
  MESSAGE: "رسالة/منشور",
  OTHER: "أخرى",
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: "جديد",
  UNDER_REVIEW: "قيد المراجعة",
  VERIFIED: "تم التحقق",
  REJECTED: "مرفوض",
  DUPLICATE: "مكرر",
};

export function confidenceColor(total: number): string {
  if (total >= 90) return "text-emerald-400";
  if (total >= 75) return "text-teal-400";
  if (total >= 60) return "text-amber-400";
  if (total >= 40) return "text-orange-400";
  return "text-rose-400";
}

export function formatDate(d: Date | string | null | undefined, locale = "ar"): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
