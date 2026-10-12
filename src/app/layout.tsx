import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { getBrand, brandStyle } from "@/lib/platform/brand";
import { Analytics } from "@vercel/analytics/next";

// Brand is owner-editable and read on every page, so the shell must render per
// request. Prerendering it at build time would also need the database during
// `next build`, which is unavailable on serverless builders such as Vercel.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "تعز الآن — منصة التحقق الذكي",
  description:
    "منصة يمنية مستقلة للتحقق من الأخبار وكشف الشائعات والتضليل، بالاعتماد على الأدلة والذكاء الاصطناعي.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const brand = await getBrand();
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased" style={brandStyle(brand)}>
        <Nav brandName={brand.name} tagline={brand.tagline} />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-center text-xs text-[var(--muted)]">
          <p className="mb-1 font-bold text-white/80">{brand.slogan}</p>
          <p>
            {brand.name} — {brand.tagline} · الحقيقة أولاً، والأدلة قبل الأحكام.
          </p>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
