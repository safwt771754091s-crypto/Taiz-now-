import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { roleHasPermission, type Permission } from "@/lib/rbac";
import { recordSecurityEvent } from "@/lib/security/events";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

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
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) {
          await recordSecurityEvent({
            kind: "LOGIN_FAILED",
            severity: "MEDIUM",
            title: `محاولة دخول فاشلة للبريد ${email}`,
            detail: { email, reason: !user ? "unknown-user" : "inactive" },
          });
          return null;
        }
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await recordSecurityEvent({
            kind: "LOGIN_FAILED",
            severity: "HIGH",
            title: `محاولة دخول فاشلة لكلمة مرور ${email}`,
            detail: { email, userId: user.id },
            subjectId: user.id,
          });
          return null;
        }
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
