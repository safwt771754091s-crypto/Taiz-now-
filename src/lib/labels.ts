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

/** Tailwind class fragments per verdict (used for badges). */
export const VERDICT_STYLES: Record<Verdict, string> = {
  TRUE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  MOSTLY_TRUE: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  MISLEADING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  SUSPICIOUS: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  FALSE: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  UNVERIFIED: "bg-slate-500/15 text-slate-300 border-slate-500/30",
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
