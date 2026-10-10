import type { AlertChannel, SecurityEventKind, SecuritySeverity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { platformAddress } from "@/lib/platform/email";
import { renderSecurityEmail, sendMail } from "@/lib/security/mail";

/** Severities worth waking someone for. */
const ALERT_AT: SecuritySeverity[] = ["HIGH", "CRITICAL"];
const ALERT_KINDS: SecurityEventKind[] = [
  "CONFIG_DRIFT",
  "BRAND_CHANGE",
  "EMAIL_CHANGE",
  "PAGE_CHANGE",
  "ROLE_CHANGE",
  "PASSWORD_CHANGE",
  "NEW_DEVICE",
  "CONNECTION_CHANGE",
  "RECOVERY",
];

export function shouldAlert(kind: SecurityEventKind, severity: SecuritySeverity): boolean {
  return ALERT_AT.includes(severity) && ALERT_KINDS.includes(kind);
}

/** Default recipients = verified/primary recovery channels + the security@ mailbox. */
export async function alertRecipients(): Promise<string[]> {
  const [recovery, emails] = await Promise.all([
    prisma.recoveryChannel.findMany({ where: { kind: "BACKUP_EMAIL" } }),
    prisma.platformEmailAccount.findMany({ where: { kind: "SECURITY" } }),
  ]);
  const set = new Set<string>();
  for (const r of recovery) set.add(r.value);
  for (const e of emails) set.add(e.address);
  if (set.size === 0) set.add(platformAddress("SECURITY"));
  return [...set];
}

export type EnqueueInput = {
  channel: AlertChannel;
  recipient: string;
  subject: string;
  body: string;
  severity: SecuritySeverity;
  securityEventId?: string | null;
};

export async function enqueueAlert(input: EnqueueInput): Promise<void> {
  await prisma.securityAlert.create({
    data: {
      channel: input.channel,
      recipient: input.recipient,
      subject: input.subject.slice(0, 200),
      body: input.body,
      severity: input.severity,
      securityEventId: input.securityEventId ?? null,
    },
  });
}

/** Fire alerts for a security event (respects severity/kind policy). */
export async function notifySecurityEvent(event: {
  id: string;
  kind: SecurityEventKind;
  severity: SecuritySeverity;
  title: string;
  detail?: unknown;
}): Promise<number> {
  if (!shouldAlert(event.kind, event.severity)) return 0;
  const recipients = await alertRecipients();
  const email = await renderSecurityEmail({ title: event.title, severity: event.severity, detail: event.detail });

  for (const to of recipients) {
    await enqueueAlert({
      channel: "EMAIL",
      recipient: to,
      subject: email.subject,
      body: email.text,
      severity: event.severity,
      securityEventId: event.id,
    });
  }
  if (process.env.SECURITY_WEBHOOK_URL) {
    await enqueueAlert({
      channel: "WEBHOOK",
      recipient: process.env.SECURITY_WEBHOOK_URL,
      subject: event.title,
      body: JSON.stringify({ title: event.title, kind: event.kind, severity: event.severity, detail: event.detail }),
      severity: event.severity,
      securityEventId: event.id,
    });
  }
  return recipients.length;
}

/** Deliver all pending alerts. Called by the guardian agent each tick. */
export async function dispatchPendingAlerts(limit = 25): Promise<{ sent: number; failed: number; skipped: number }> {
  const pending = await prisma.securityAlert.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const a of pending) {
    if (a.channel === "INBOX") {
      await prisma.securityAlert.update({ where: { id: a.id }, data: { status: "SENT", sentAt: new Date() } });
      sent++;
      continue;
    }
    if (a.channel === "WEBHOOK") {
      try {
        const res = await fetch(a.recipient, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: a.body,
        });
        await prisma.securityAlert.update({
          where: { id: a.id },
          data: { status: res.ok ? "SENT" : "FAILED", sentAt: new Date(), error: res.ok ? null : `HTTP ${res.status}` },
        });
        res.ok ? sent++ : failed++;
      } catch (err) {
        await prisma.securityAlert.update({
          where: { id: a.id },
          data: { status: "FAILED", error: err instanceof Error ? err.message : "webhook error" },
        });
        failed++;
      }
      continue;
    }

    // EMAIL
    const result = await sendMail({ to: a.recipient, subject: a.subject, text: a.body });
    if (result.status === "SENT") {
      await prisma.securityAlert.update({ where: { id: a.id }, data: { status: "SENT", sentAt: new Date(), error: null } });
      sent++;
    } else if (result.transport === "inbox") {
      // No SMTP: keep as a recorded, inspectable message rather than a failure.
      await prisma.securityAlert.update({
        where: { id: a.id },
        data: { status: "SKIPPED", error: result.error ?? null, sentAt: new Date() },
      });
      skipped++;
    } else {
      await prisma.securityAlert.update({
        where: { id: a.id },
        data: { status: "FAILED", error: result.error ?? null },
      });
      failed++;
    }
  }
  return { sent, failed, skipped };
}
