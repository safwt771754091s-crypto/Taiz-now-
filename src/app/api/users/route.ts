import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { clientIp, fail, handleError, ok, writeAudit } from "@/lib/http";
import { ROLES } from "@/lib/rbac";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
  role: z.enum(["OWNER", "EDITOR", "FACT_CHECKER", "MEDIA_ANALYST", "GEO_ANALYST", "SOCIAL_PUBLISHER", "VIEWER"]),
});

export async function GET() {
  try {
    await requirePermission("users:manage");
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
    return ok({ users, roles: ROLES });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requirePermission("users:manage");
    const data = createSchema.parse(await req.json());
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return fail("البريد الإلكتروني مستخدم مسبقاً", 409);

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { email: data.email, name: data.name, passwordHash, role: data.role },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
    await writeAudit({
      actorId: actor?.id,
      action: "user.create",
      entityType: "User",
      entityId: user.id,
      detail: { role: data.role },
      ip: clientIp(req),
    });
    return ok(user, 201);
  } catch (err) {
    return handleError(err);
  }
}
