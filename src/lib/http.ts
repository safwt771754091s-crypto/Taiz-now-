import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof AuthError) return fail(err.message, err.status);
  if (err instanceof ZodError) {
    return fail("بيانات غير صحيحة", 422, { issues: err.issues.map((i) => i.message) });
  }
  console.error("[api-error]", err);
  const message = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
  return fail(message, 500);
}

export async function writeAudit(input: {
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  detail?: unknown;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        detail: (input.detail ?? undefined) as object | undefined,
        ip: input.ip ?? null,
      },
    });
  } catch (err) {
    console.error("[audit-error]", err);
  }
}

export function clientIp(req: Request): string | null {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null
  );
}
