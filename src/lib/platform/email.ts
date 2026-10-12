import { prisma } from "@/lib/prisma";
import { recordSecurityEvent } from "@/lib/security/events";

/**
 * Platform email identity. The platform owns a mailbox per function
 * (info@ / security@ / noreply@) on its own domain. Creating the mailbox
 * itself is an operator step at the mail provider; this service records and
 * links the addresses so the platform and its agents can use one identity.
 */

export type EmailKind = "INFO" | "SUPPORT" | "NOREPLY" | "SECURITY";

export const EMAIL_KIND_LABELS: Record<EmailKind, string> = {
  INFO: "عام",
  SUPPORT: "دعم",
  NOREPLY: "لا للرد",
  SECURITY: "أمني",
};

export const EMAIL_PREFIXES: Record<EmailKind, string> = {
  INFO: "info",
  SUPPORT: "support",
  NOREPLY: "noreply",
  SECURITY: "security",
};

/** The platform's domain, used to derive addresses. Set PLATFORM_DOMAIN to a
 * real owned domain (e.g. taiznow.ye) or a Google Workspace domain. */
export function platformDomain(): string {
  return (process.env.PLATFORM_DOMAIN || "taiznow.ye").replace(/^@/, "").toLowerCase();
}

export function platformAddress(kind: EmailKind): string {
  return `${EMAIL_PREFIXES[kind]}@${platformDomain()}`;
}

/** Create/refresh the standard platform mailboxes (idempotent). */
export async function ensurePlatformEmails(brandName: string): Promise<void> {
  for (const kind of Object.keys(EMAIL_PREFIXES) as EmailKind[]) {
    const address = platformAddress(kind);
    await prisma.platformEmailAccount.upsert({
      where: { address },
      create: { address, kind, displayName: `${brandName} — ${EMAIL_KIND_LABELS[kind]}`, provider: "custom-domain" },
      update: {},
    });
  }
  await syncGoogleIdentity();
}

/** Reflect the primary mailbox onto the Google PlatformIdentity. */
async function syncGoogleIdentity(): Promise<void> {
  const info = await prisma.platformEmailAccount.findUnique({ where: { address: platformAddress("INFO") } });
  await prisma.platformIdentity.upsert({
    where: { provider: "google" },
    create: {
      provider: "google",
      handle: platformAddress("INFO"),
      email: info?.address ?? platformAddress("INFO"),
      connected: true,
      linkedVia: "domain",
    },
    update: {
      handle: platformAddress("INFO"),
      email: info?.address ?? platformAddress("INFO"),
      connected: true,
      linkedVia: "domain",
    },
  });
}

/**
 * Link a real Google account to the platform identity. The operator performs
 * the OAuth consent at Google; passing the resulting address here records it.
 * Marks the matching mailbox verified when the domain aligns.
 */
export async function linkGoogleAccount(email: string, actorId: string | null): Promise<{ address: string }> {
  const normalized = email.trim().toLowerCase();
  const domain = platformDomain();

  await prisma.platformIdentity.upsert({
    where: { provider: "google" },
    create: { provider: "google", handle: normalized, email: normalized, connected: true, linkedVia: "oauth" },
    update: { handle: normalized, email: normalized, connected: true, linkedVia: "oauth" },
  });

  // A mailbox is verified once it matches the owned domain.
  if (normalized.endsWith(`@${domain}`)) {
    await prisma.platformEmailAccount.updateMany({
      where: { address: normalized },
      data: { verified: true, provider: "google", linkedVia: "oauth" },
    });
  }

  await recordSecurityEvent({
    kind: "EMAIL_CHANGE",
    severity: "MEDIUM",
    title: "ربط حساب جوجل بالمنصة",
    detail: { email: normalized, domain, matchesDomain: normalized.endsWith(`@${domain}`) },
    actorId,
  });

  return { address: normalized };
}

export type EmailAccountView = {
  address: string;
  kind: EmailKind;
  kindLabel: string;
  displayName: string;
  provider: string;
  linkedVia: string;
  verified: boolean;
};

export async function listPlatformEmails(): Promise<EmailAccountView[]> {
  const rows = await prisma.platformEmailAccount.findMany({ orderBy: { kind: "asc" } });
  return rows.map((r) => ({
    address: r.address,
    kind: r.kind as EmailKind,
    kindLabel: EMAIL_KIND_LABELS[r.kind as EmailKind],
    displayName: r.displayName,
    provider: r.provider,
    linkedVia: r.linkedVia,
    verified: r.verified,
  }));
}

/** The address the platform sends from / shows as its official contact. */
export function primaryEmail(): string {
  return platformAddress("INFO");
}
