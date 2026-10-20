"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "@/components/Logo";

const SECTIONS = [
  { href: "/", label: "الرئيسية" },
  { href: "/news", label: "الأخبار" },
  { href: "/rumors", label: "مرصد الشائعات" },
  { href: "/corrections", label: "التصحيحات" },
  { href: "/maps", label: "الخرائط" },
  { href: "/reports", label: "أرسل بلاغًا" },
];

const TEAM = [
  { href: "/owner", label: "لوحة المالك" },
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/visitors", label: "الزوار" },
  { href: "/agents", label: "الوكلاء" },
  { href: "/platform", label: "الهوية" },
  { href: "/security", label: "الأمن" },
];

type OwnerSection = { slug: string; title: string; icon: string | null };

export default function Nav({
  brandName = "تعز الآن",
  tagline = "منصة التحقق الذكي",
}: {
  brandName?: string;
  tagline?: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [ownerSections, setOwnerSections] = useState<OwnerSection[]>([]);

  // The owner can add sections from the control panel; show them in the bar.
  // The four default sections (news/rumors/corrections/maps) already have
  // dedicated links above, so only extra sections are appended.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/public/sections");
        const json = await res.json();
        if (!res.ok) return;
        const known = new Set(["news", "rumors", "corrections", "maps"]);
        setOwnerSections(
          (json.data.sections as OwnerSection[]).filter((s) => !known.has(s.slug)),
        );
      } catch {
        /* navigation is best-effort; never block the shell */
      }
    })();
  }, []);

  const today = new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 bg-[var(--background)]">
      {/* Top strip */}
      <div className="bg-[#14181f] text-white/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1.5 text-[11px]">
          <span>{today}</span>
          <span className="hidden sm:inline">الحقيقة أولاً — والأدلة قبل الأحكام</span>
          <Link href="/reports/new" className="text-white/90 hover:text-white">
            أبلغ عن تضليل ↗
          </Link>
        </div>
      </div>

      {/* Masthead */}
      <div className="border-b border-[var(--border-strong)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="shrink-0">
            <Logo name={brandName} tagline={tagline} />
          </Link>
          <div className="hidden items-center gap-2 md:flex">
            <Link href="/login" className="btn-ghost px-3 py-1.5 text-sm">
              دخول الفريق
            </Link>
            <Link href="/reports/new" className="btn-primary px-4 py-1.5 text-sm">
              أرسل بلاغًا
            </Link>
          </div>
          <button
            type="button"
            aria-label="القائمة"
            onClick={() => setOpen((v) => !v)}
            className="btn-ghost px-3 py-1.5 text-sm md:hidden"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Section bar */}
      <nav className="masthead-rule bg-[var(--panel)]">
        <div className="mx-auto hidden max-w-6xl items-center gap-1 px-2 md:flex">
          {SECTIONS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-2.5 text-sm font-bold transition ${
                  active
                    ? "border-b-[3px] border-[var(--brand)] text-[var(--brand)]"
                    : "border-b-[3px] border-transparent text-[var(--foreground)] hover:text-[var(--brand)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          {ownerSections.map((s) => {
            const href = `/sections/${s.slug}`;
            const active = path.startsWith(href);
            return (
              <Link
                key={s.slug}
                href={href}
                className={`px-3 py-2.5 text-sm font-bold transition ${
                  active
                    ? "border-b-[3px] border-[var(--brand)] text-[var(--brand)]"
                    : "border-b-[3px] border-transparent text-[var(--foreground)] hover:text-[var(--brand)]"
                }`}
              >
                {s.icon ? `${s.icon} ` : ""}
                {s.title}
              </Link>
            );
          })}
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          {TEAM.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-2.5 text-xs transition ${
                path.startsWith(l.href)
                  ? "text-[var(--brand)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="grid gap-0 border-t border-[var(--border)] px-4 py-2 md:hidden">
            {[...SECTIONS, ...ownerSections.map((s) => ({ href: `/sections/${s.slug}`, label: `${s.icon ?? ""} ${s.title}`.trim() })), ...TEAM].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-[var(--border)] py-2.5 text-sm font-bold last:border-0"
              >
                {l.label}
              </Link>
            ))}
            <Link href="/login" onClick={() => setOpen(false)} className="py-2.5 text-sm font-bold text-[var(--brand)]">
              دخول الفريق
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
