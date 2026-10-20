import { handleError, ok } from "@/lib/http";
import { listSections } from "@/lib/platform/sections";

/** Public list of published sections, used to build the site navigation. */
export async function GET() {
  try {
    const sections = await listSections({ onlyPublished: true });
    return ok({
      sections: sections.map((s) => ({
        slug: s.slug,
        title: s.title,
        icon: s.icon,
        color: s.color,
        description: s.description,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
