import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { clientIp, handleError, ok, writeAudit } from "@/lib/http";
import { recordSecurityEvent } from "@/lib/security/events";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  role: z
    .enum(["OWNER", "EDITOR", "FACT_CHECKER", "MEDIA_ANALYST", "GEO_ANALYST", "SOCIAL_PUBLISHER", "VIEWER"])
    .optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("users:manage");
    const { id } = await ctx.params;
    const data = patchSchema.parse(await req.json());

    const before = await prisma.user.findUnique({ where: { id }, select: { role: true, active: true, name: true } });

    const update: Record<string, unknown> = {};
    if (data.name) update.name = data.name;
    if (data.role) update.role = data.role;
    if (typeof data.active === "boolean") update.active = data.active;
    if (data.password) update.passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.update({
      where: { id },
      data: update,
      select: { id: true, email: true, name: true, role: true, active: true },
    });
    await writeAudit({
      actorId: actor?.id,
      action: "user.update",
      entityType: "User",
      entityId: id,
      detail: { fields: Object.keys(update) },
      ip: clientIp(req),
    });

    // Security trail: password and privilege changes are classic hijack signals.
    if (data.password) {
      await recordSecurityEvent({
        kind: "PASSWORD_CHANGE",
        severity: "HIGH",
        title: `تغيير كلمة مرور المستخدم ${user.email}`,
        detail: { targetId: id, bySelf: actor?.id === id },
        actorId: actor?.id ?? null,
        subjectId: id,
      });
    }
    if (data.role && before?.role !== data.role) {
      await recordSecurityEvent({
        kind: "ROLE_CHANGE",
        severity: "CRITICAL",
        title: `تغيير صلاحية ${user.email} من ${before?.role} إلى ${data.role}`,
        detail: { targetId: id, from: before?.role, to: data.role },
        actorId: actor?.id ?? null,
        subjectId: id,
      });
    }
    if (typeof data.active === "boolean" && before?.active !== data.active) {
      await recordSecurityEvent({
        kind: "ROLE_CHANGE",
        severity: data.active ? "MEDIUM" : "HIGH",
        title: `${data.active ? "تنشيط" : "تعطيل"} حساب ${user.email}`,
        detail: { targetId: id },
        actorId: actor?.id ?? null,
        subjectId: id,
      });
    }
    return ok(user);
  } catch (err) {
    return handleError(err);
  }
}
