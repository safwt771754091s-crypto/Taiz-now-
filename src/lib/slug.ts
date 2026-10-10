/** Produce a URL-safe slug; keeps Arabic letters and digits. */
export function slugify(input: string): string {
  const base = input
    .trim()
    .replace(/[\s/\\]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return base || `item-${Date.now()}`;
}
