import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "تعز الآن — منصة التحقق الذكي",
  description:
    "منصة يمنية مستقلة للتحقق من الأخبار وكشف الشائعات والتضليل، بالاعتماد على الأدلة والذكاء الاصطناعي.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-center text-xs text-[var(--muted)]">
          <p className="mb-1 font-bold text-white/80">لا ننشر ما يُقال... بل نتحقق مما حدث.</p>
          <p>تعز الآن — منصة التحقق الذكي · الحقيقة أولاً، والأدلة قبل الأحكام.</p>
        </footer>
      </body>
    </html>
  );
}
