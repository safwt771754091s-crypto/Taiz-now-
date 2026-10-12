import type { ReactNode } from "react";
import { VERDICT_LABELS, VERDICT_STYLES, confidenceColor } from "@/lib/labels";
import type { Verdict } from "@prisma/client";

export function VerdictBadge({ verdict, confidence }: { verdict: Verdict; confidence?: number }) {
  return (
    <span className={`chip border font-bold ${VERDICT_STYLES[verdict]}`}>
      <span>{VERDICT_LABELS[verdict]}</span>
      {typeof confidence === "number" && <span className="opacity-80">{confidence}/100</span>}
    </span>
  );
}

export function ConfidenceBar({ total }: { total: number }) {
  const tone = total >= 75 ? "ok" : total >= 40 ? "" : "warn";
  return (
    <div className="flex items-center gap-2">
      <div className={`meter w-28 ${tone}`}>
        <span style={{ width: `${Math.max(0, Math.min(100, total))}%` }} />
      </div>
      <span className={`text-sm font-bold ${confidenceColor(total)}`}>{total}/100</span>
    </div>
  );
}

export function Panel({
  title,
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="card p-4">
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-3">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-[var(--muted)]">{children}</p>;
}

/** Section heading used across the editorial pages. */
export function SectionHeading({
  title,
  href,
  accent = "var(--brand)",
}: {
  title: string;
  href?: string;
  accent?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <span className="inline-block h-5 w-1.5 rounded-sm" style={{ background: accent }} />
        {title}
      </h2>
      {href && (
        <a href={href} className="text-sm font-bold link">
          عرض الكل ←
        </a>
      )}
    </div>
  );
}
