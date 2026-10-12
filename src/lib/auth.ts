import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { roleHasPermission, type Permission } from "@/lib/rbac";
import { recordSecurityEvent } from "@/lib/security/events";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function fingerprintOf(ip: string | null, ua: string | null): string {
  return createHash("sha256").update(`${ip ?? "?"}|${ua ?? "?"}`).digest("hex").slice(0, 32);
}

/**
 * Record every login attempt and flag a successful sign-in from a device /
 * location we have never seen for this account (a classic hijack signal).
 */
async function auditLogin(input: {
  userId: string | null;
  email: string;
  ok: boolean;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const fingerprint = fingerprintOf(input.ip, input.userAgent);
  if (input.ok && input.userId) {
    const seen = await prisma.loginEvent.count({
      where: { userId: input.userId, ok: true, fingerprint },
    });
    const priorSuccess = await prisma.loginEvent.count({ where: { userId: input.userId, ok: true } });
    if (seen === 0 && priorSuccess > 0) {
      await recordSecurityEvent({
        kind: "NEW_DEVICE",
        severity: "HIGH",
        title: `دخول من جهاز/موقع جديد للحساب ${input.email}`,
        detail: { ip: input.ip, userAgent: input.userAgent },
        subjectId: input.userId,
      });
    }
  }
  await prisma.loginEvent.create({
    data: {
      userId: input.userId,
      email: input.email,
      ok: input.ok,
      ip: input.ip,
      userAgent: input.userAgent,
      fingerprint,
    },
  });
}

function requestMeta(req: Request | undefined): { ip: string | null; userAgent: string | null } {
  if (!req?.headers) return { ip: null, userAgent: null };
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  return { ip, userAgent: h.get("user-agent") };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "البريد الإلكتروني", type: "email" },
        password: { label: "كلمة المرور", type: "password" },
      },
      authorize: async (raw, req) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const meta = requestMeta(req);
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) {
          await auditLogin({ userId: user?.id ?? null, email, ok: false, ...meta });
          await recordSecurityEvent({
            kind: "LOGIN_FAILED",
            severity: "MEDIUM",
            title: `محاولة دخول فاشلة للبريد ${email}`,
            detail: { email, reason: !user ? "unknown-user" : "inactive", ip: meta.ip },
          });
          return null;
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await auditLogin({ userId: user.id, email, ok: false, ...meta });
          await recordSecurityEvent({
            kind: "LOGIN_FAILED",
            severity: "HIGH",
            title: `محاولة دخول فاشلة لكلمة مرور ${email}`,
            detail: { email, userId: user.id, ip: meta.ip },
            subjectId: user.id,
          });
          return null;
        }
        await auditLogin({ userId: user.id, email, ok: true, ...meta });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});

/** Convenience: current session's user id + role, or null. */
export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, role: session.user.role as Role, name: session.user.name ?? "" };
}

export async function can(permission: Permission): Promise<boolean> {
  const u = await currentUser();
  return roleHasPermission(u?.role, permission);
}

/** Throws a Response-friendly error when the current user lacks the permission. */
export async function requirePermission(permission: Permission) {
  const u = await currentUser();
  if (!roleHasPermission(u?.role, permission)) {
    throw new AuthError("لا تملك الصلاحية لتنفيذ هذا الإجراء", 403);
  }
  return u!;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}
