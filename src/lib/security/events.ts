import type { SecurityEventKind, SecuritySeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SecurityInput = {
  kind: SecurityEventKind;
  severity?: SecuritySeverity;
  title: string;
  detail?: unknown;
  actorId?: string | null;
  subjectId?: string | null;
};

/** Record a security event. Never throws — logging must not break a request. */
export async function recordSecurityEvent(input: SecurityInput): Promise<void> {
  try {
    const event = await prisma.securityEvent.create({
      data: {
        kind: input.kind,
        severity: input.severity ?? "INFO",
        title: input.title.slice(0, 200),
        detail: (input.detail ?? undefined) as never,
        actorId: input.actorId ?? null,
        subjectId: input.subjectId ?? null,
      },
    });
    // Queue alerts for high-severity events; delivery happens on the next tick.
    const { notifySecurityEvent } = await import("@/lib/security/alerts");
    await notifySecurityEvent({
      id: event.id,
      kind: event.kind,
      severity: event.severity,
      title: event.title,
      detail: event.detail,
    });
  } catch {
    // Swallow: a failed audit write must not fail the primary action.
  }
}

/** Severity ordering for filtering / UI. */
export const SEVERITY_ORDER: SecuritySeverity[] = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const SEVERITY_LABELS: Record<SecuritySeverity, string> = {
  INFO: "معلومة",
  LOW: "منخفض",
  MEDIUM: "متوسط",
  HIGH: "مرتفع",
  CRITICAL: "حرج",
};

export const SEVERITY_STYLES: Record<SecuritySeverity, string> = {
  INFO: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  LOW: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  HIGH: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  CRITICAL: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export const SECURITY_KIND_LABELS: Record<SecurityEventKind, string> = {
  CONFIG_DRIFT: "انحراف إعدادات",
  BRAND_CHANGE: "تغيير الهوية",
  EMAIL_CHANGE: "تغيير بريد المنصة",
  PAGE_CHANGE: "تغيير صفحة",
  ROLE_CHANGE: "تغيير صلاحية",
  PASSWORD_CHANGE: "تغيير كلمة مرور",
  LOGIN_FAILED: "محاولة دخول فاشلة",
  NEW_DEVICE: "دخول من جهاز جديد",
  CONNECTION_CHANGE: "تغيير قناة تواصل",
  INTEGRITY_OK: "سلامة سليمة",
  RECOVERY: "استعادة",
};
