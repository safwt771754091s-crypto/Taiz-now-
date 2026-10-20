import { requirePermission } from "@/lib/auth";
import { handleError, ok } from "@/lib/http";
import { ownerOverview } from "@/lib/platform/overview";

export async function GET() {
  try {
    await requirePermission("platform:manage");
    return ok(await ownerOverview());
  } catch (err) {
    return handleError(err);
  }
}
