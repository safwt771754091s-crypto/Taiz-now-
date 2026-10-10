import type { ReactNode } from "react";
import { VERDICT_LABELS, VERDICT_STYLES, confidenceColor } from "@/lib/labels";
import type { Verdict } from "@prisma/client";

export function VerdictBadge({ verdict, confidence }: { verdict: Verdict; confidence?: number }) {
  return (
    <span className={`chip border ${VERDICT_STYLES[verdict]}`}>
      <span>{VERDICT_LABELS[verdict]}</span>
      {typeof confidence === "number" && <span className="opacity-80">{confidence}/100</span>}
    </span>
  );
}

export function ConfidenceBar({ total }: { total: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-l from-teal-400 to-sky-500"
          style={{ width: `${Math.max(0, Math.min(100, total))}%` }}
        />
      </div>
      <span className={`text-sm font-bold ${confidenceColor(total)}`}>{total}</span>
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
        <header className="mb-3 flex items-center justify-between">
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
