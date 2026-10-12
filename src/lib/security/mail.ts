import { createTransport, type Transporter } from "nodemailer";
import { platformAddress } from "@/lib/platform/email";
import { getBrand } from "@/lib/platform/brand";

/**
 * Outbound mail. In production set SMTP_HOST/USER/PASS and we deliver for real;
 * otherwise every message is recorded on the SecurityAlert row (transport
 * "inbox") so the platform still has a full, inspectable outbox with no keys.
 */

export type MailResult = { status: "SENT" | "SKIPPED"; transport: "smtp" | "inbox" | "none"; error?: string };

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

let cached: Transporter | null = null;
function transport(): Transporter {
  if (cached) return cached;
  cached = createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return cached;
}

export async function sendMail(input: { to: string; subject: string; text: string; html?: string }): Promise<MailResult> {
  if (!smtpConfigured()) {
    // No SMTP: leave the message in the platform outbox (SecurityAlert row).
    return { status: "SKIPPED", transport: "inbox", error: "SMTP غير مهيأ — حُفظت الرسالة في صندوق الصادر" };
  }
  try {
    const brand = await getBrand();
    const from = process.env.SMTP_FROM || platformAddress("NOREPLY");
    await transport().sendMail({
      from: `"${brand.name}" <${from}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { status: "SENT", transport: "smtp" };
  } catch (err) {
    return { status: "SKIPPED", transport: "smtp", error: err instanceof Error ? err.message : "فشل الإرسال" };
  }
}

/** Renders a branded, RTL alert email for a security event. */
export async function renderSecurityEmail(input: { title: string; severity: string; detail?: unknown }): Promise<{ subject: string; text: string; html: string }> {
  const brand = await getBrand();
  const subject = `[${brand.name}] تنبيه أمني: ${input.title}`;
  const detail = input.detail ? JSON.stringify(input.detail, null, 2) : "";
  const text = `${brand.name}\nتنبيه أمني (${input.severity})\n${input.title}\n${detail}\n\n${brand.slogan}`;
  const html = `<div dir="rtl" style="font-family:system-ui,sans-serif;max-width:560px">
    <h2 style="color:${brand.primary}">${brand.name}</h2>
    <p style="font-size:15px"><b>تنبيه أمني</b> — الخطورة: ${input.severity}</p>
    <p style="font-size:15px">${input.title}</p>
    ${detail ? `<pre style="background:#0b1220;color:#cbd5e1;padding:12px;border-radius:8px;font-size:12px">${detail}</pre>` : ""}
    <p style="color:#64748b;font-size:12px">${brand.slogan}</p>
  </div>`;
  return { subject, text, html };
}
