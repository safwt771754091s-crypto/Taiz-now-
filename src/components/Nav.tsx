"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "الرئيسية" },
  { href: "/news", label: "الأخبار" },
  { href: "/rumors", label: "الشائعات" },
  { href: "/corrections", label: "التصحيحات" },
  { href: "/reports", label: "البلاغات" },
  { href: "/maps", label: "الخرائط" },
  { href: "/agents", label: "الوكلاء" },
  { href: "/platform", label: "الهوية" },
  { href: "/security", label: "الأمن" },
  { href: "/dashboard", label: "لوحة التحكم" },
];

export default function Nav({ brandName = "تعز الآن", tagline = "منصة التحقق الذكي" }: { brandName?: string; tagline?: string }) {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[#070b14]/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-sky-500 text-lg font-black text-[#041018]">
            {brandName.trim().charAt(0) || "ت"}
          </span>
          <span className="leading-tight">
            <span className="block font-black">{brandName}</span>
            <span className="block text-[11px] text-[var(--muted)]">{tagline}</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-1 text-sm">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 transition ${
                  active ? "bg-white/10 font-bold text-white" : "text-[var(--muted)] hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/login" className="chip border-brand/40 text-brand hover:bg-white/5">
          دخول الفريق
        </Link>
      </div>
    </header>
  );
}
