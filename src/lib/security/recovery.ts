import type { RecoveryChannelKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/security/events";

export const RECOVERY_KIND_LABELS: Record<RecoveryChannelKind, string> = {
  BACKUP_EMAIL: "بريد احتياطي",
  PHONE: "رقم هاتف",
  TOTP: "رمز تحقق (TOTP)",
};

const EMAILISH = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Mask a contact so the console can show it without exposing the full value. */
export function maskValue(kind: RecoveryChannelKind, value: string): string {
  if (kind === "BACKUP_EMAIL") {
    const [user, domain] = value.split("@");
    const head = user.slice(0, 2);
    return `${head}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "•".repeat(value.length);
}

export async function listRecoveryChannels() {
  const rows = await prisma.recoveryChannel.findMany({ orderBy: [{ primary: "desc" }, { createdAt: "asc" }] });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as RecoveryChannelKind,
    kindLabel: RECOVERY_KIND_LABELS[r.kind as RecoveryChannelKind],
    label: r.label,
    masked: maskValue(r.kind as RecoveryChannelKind, r.value),
    verified: r.verified,
    primary: r.primary,
    userId: r.userId,
  }));
}

export async function addRecoveryChannel(input: {
  kind: RecoveryChannelKind;
  label: string;
  value: string;
  userId?: string | null;
  primary?: boolean;
  actorId: string | null;
}): Promise<{ id: string }> {
  const value = input.value.trim();
  if (input.kind === "BACKUP_EMAIL" && !EMAILISH.test(value)) {
    throw new Error("بريد احتياطي غير صالح");
  }
  if (input.kind === "PHONE" && value.replace(/\D/g, "").length < 7) {
    throw new Error("رقم هاتف غير صالح");
  }

  if (input.primary) {
    await prisma.recoveryChannel.updateMany({ where: { primary: true }, data: { primary: false } });
  }
  const row = await prisma.recoveryChannel.create({
    data: {
      kind: input.kind,
      label: input.label.trim() || RECOVERY_KIND_LABELS[input.kind],
      value,
      userId: input.userId ?? null,
      primary: input.primary ?? false,
    },
  });
  await recordSecurityEvent({
    kind: "EMAIL_CHANGE",
    severity: "LOW",
    title: `إضافة قناة استرجاع (${RECOVERY_KIND_LABELS[input.kind]})`,
    detail: { masked: maskValue(input.kind, value), primary: input.primary ?? false },
    actorId: input.actorId,
  });
  return { id: row.id };
}

export async function removeRecoveryChannel(id: string, actorId: string | null): Promise<void> {
  const row = await prisma.recoveryChannel.delete({ where: { id } });
  await recordSecurityEvent({
    kind: "EMAIL_CHANGE",
    severity: "MEDIUM",
    title: `حذف قناة استرجاع (${RECOVERY_KIND_LABELS[row.kind as RecoveryChannelKind]})`,
    detail: { masked: maskValue(row.kind as RecoveryChannelKind, row.value) },
    actorId,
  });
}
