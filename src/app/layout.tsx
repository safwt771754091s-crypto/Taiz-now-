import type { Metadata } from "next";
import "./globals.css";
import { Amiri, Noto_Sans_Arabic } from "next/font/google";
import Nav from "@/components/Nav";
import Logo from "@/components/Logo";
import VisitTracker from "@/components/VisitTracker";
import { getBrand, brandStyle } from "@/lib/platform/brand";
import { Analytics } from "@vercel/analytics/next";

// Brand is owner-editable and read on every page, so the shell must render per
// request. Prerendering it at build time would also need the database during
// `next build`, which is unavailable on serverless builders such as Vercel.
export const dynamic = "force-dynamic";

const serif = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-body",
  display: "swap",
});

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
    <html lang="ar" dir="rtl" className={`${serif.variable} ${sans.variable}`}>
      <body className="antialiased" style={brandStyle(brand)}>
        <Nav brandName={brand.name} tagline={brand.tagline} />
        <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">{children}</main>
        <footer className="mt-10 bg-[#14181f] text-white/80">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-3">
            <div>
              <Logo name={brand.name} tagline={brand.tagline} size={40} tone="light" />
              <p className="mt-4 text-sm text-white/70">{brand.slogan}</p>
            </div>
            <div className="text-sm">
              <p className="eyebrow text-white/50">الأقسام</p>
              <ul className="mt-3 space-y-2 text-white/80">
                <li>الأخبار الموثقة</li>
                <li>مرصد الشائعات</li>
                <li>مركز التصحيحات</li>
                <li>الخرائط والتحقق الجغرافي</li>
              </ul>
            </div>
            <div className="text-sm">
              <p className="eyebrow text-white/50">منهجيتنا</p>
              <p className="mt-3 leading-relaxed text-white/70">
                لا ننشر ما يُقال... بل نتحقق مما حدث. نعتمد الأدلة والمصادر، ونصحّح شفافًا عند ورود
                معلومات جديدة.
              </p>
            </div>
          </div>
          <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
            © {new Date().getFullYear()} {brand.name} — الحقيقة أولاً، والأدلة قبل الأحكام.
          </div>
        </footer>
        <VisitTracker />
        <Analytics />
      </body>
    </html>
  );
}
