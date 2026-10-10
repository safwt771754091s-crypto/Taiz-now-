import { Verdict } from "@prisma/client";

/**
 * Confidence scoring model (from the project brief):
 *   المصدر 25% · المحتوى 20% · الصور 15% · الفيديو 15% · السياق 15% · التدقيق البشري 10%
 */
export const CONFIDENCE_WEIGHTS = {
  source: 25,
  content: 20,
  image: 15,
  video: 15,
  context: 15,
  human: 10,
} as const;

export type ConfidenceSignals = {
  source: number; // 0-100
  content: number;
  image: number;
  video: number;
  context: number;
  human: number;
};

export type ConfidenceBreakdown = {
  total: number;
  verdict: Verdict;
  band: string;
  bandLabel: string;
  components: { key: keyof ConfidenceSignals; weight: number; score: number; contribution: number }[];
};

export const EMPTY_SIGNALS: ConfidenceSignals = {
  source: 0,
  content: 0,
  image: 0,
  video: 0,
  context: 0,
  human: 0,
};

function clamp(n: number, min = 0, max = 100): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/** Weighted total, 0-100, rounded. Each signal is clamped to 0-100 first. */
export function computeTotal(signals: ConfidenceSignals): number {
  const raw =
    clamp(signals.source) * CONFIDENCE_WEIGHTS.source +
    clamp(signals.content) * CONFIDENCE_WEIGHTS.content +
    clamp(signals.image) * CONFIDENCE_WEIGHTS.image +
    clamp(signals.video) * CONFIDENCE_WEIGHTS.video +
    clamp(signals.context) * CONFIDENCE_WEIGHTS.context +
    clamp(signals.human) * CONFIDENCE_WEIGHTS.human;
  return Math.round(raw / 100);
}

export type ConfidenceBand = "verified" | "true" | "likely" | "suspicious" | "false";

/**
 * Verdict bands from the brief:
 *   90-100 موثق · 75-89 صحيح · 60-74 صحيح غالباً · 40-59 مشبوه · 0-39 غير صحيح
 */
export function bandFor(total: number): { band: ConfidenceBand; label: string; verdict: Verdict } {
  if (total >= 90) return { band: "verified", label: "موثق", verdict: "TRUE" };
  if (total >= 75) return { band: "true", label: "صحيح", verdict: "MOSTLY_TRUE" };
  if (total >= 60) return { band: "likely", label: "صحيح غالباً", verdict: "MISLEADING" };
  if (total >= 40) return { band: "suspicious", label: "مشبوه", verdict: "SUSPICIOUS" };
  return { band: "false", label: "غير صحيح", verdict: "FALSE" };
}

export function score(signals: Partial<ConfidenceSignals>): ConfidenceBreakdown {
  const s: ConfidenceSignals = {
    source: clamp(signals.source ?? 0),
    content: clamp(signals.content ?? 0),
    image: clamp(signals.image ?? 0),
    video: clamp(signals.video ?? 0),
    context: clamp(signals.context ?? 0),
    human: clamp(signals.human ?? 0),
  };
  const total = computeTotal(s);
  const { band, label, verdict } = bandFor(total);
  const components = (Object.keys(CONFIDENCE_WEIGHTS) as (keyof ConfidenceSignals)[]).map((key) => ({
    key,
    weight: CONFIDENCE_WEIGHTS[key],
    score: s[key],
    contribution: (s[key] * CONFIDENCE_WEIGHTS[key]) / 100,
  }));
  return { total, verdict, band, bandLabel: label, components };
}
