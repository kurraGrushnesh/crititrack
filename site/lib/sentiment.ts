/**
 * Sentiment score bands.
 *
 * The thresholds match the app's own (`Hero.tsx` uses the same numbers,
 * and the Flutter client keys its palette off them): 65 and above reads
 * positive, 40 to 64 mixed, below 40 negative. Kept in one place so the
 * globe, the figure list, and every profile card agree.
 */

export type SentimentBand = "positive" | "mixed" | "negative";

export function sentimentBand(score: number): SentimentBand {
  if (score >= 65) return "positive";
  if (score >= 40) return "mixed";
  return "negative";
}

/** CSS custom-property name for the band colour, for inline styles. */
export function sentimentColorVar(score: number): string {
  switch (sentimentBand(score)) {
    case "positive":
      return "var(--good)";
    case "mixed":
      return "var(--mid)";
    case "negative":
      return "var(--bad)";
  }
}

export function sentimentLabel(score: number): string {
  switch (sentimentBand(score)) {
    case "positive":
      return "Coverage skews positive";
    case "mixed":
      return "Coverage is mixed";
    case "negative":
      return "Coverage skews negative";
  }
}

/**
 * A plain-language gloss on the confidence value, so "Low confidence"
 * isn't a bare label. Confidence blends how much the per-source scores
 * agreed with how much coverage was sampled.
 */
export function confidenceExplainer(confidence: number): string {
  if (confidence >= 0.75) {
    return "The news, YouTube and overall scores agree and the sample is healthy — take the number at face value.";
  }
  if (confidence >= 0.5) {
    return "The per-source scores mostly line up. Read the number as a solid estimate.";
  }
  return "The per-source scores pull in different directions, or too few items were found. Read the number as a rough direction, not a precise figure.";
}

/**
 * The positive / neutral / negative make-up of a sample, as ordered
 * slices ready to draw. Order is fixed (positive, neutral, negative) so
 * the colour of a slice is redundant with its position — the donut and
 * its legend agree, and a filter can never repaint a slice.
 *
 * `fraction` is the share of the total; slices with a zero count are
 * still returned (the caller drops them from the ring but may keep them
 * in the legend).
 */
export interface SentimentSlice {
  key: "positive" | "neutral" | "negative";
  label: string;
  count: number;
  fraction: number;
  colorVar: string;
}

export function sentimentComposition(counts: {
  positive: number;
  neutral: number;
  negative: number;
}): { slices: SentimentSlice[]; total: number } {
  const clamp = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  const pos = clamp(counts.positive);
  const neu = clamp(counts.neutral);
  const neg = clamp(counts.negative);
  const total = pos + neu + neg;
  const slice = (
    key: SentimentSlice["key"],
    label: string,
    count: number,
    colorVar: string,
  ): SentimentSlice => ({
    key,
    label,
    count,
    fraction: total > 0 ? count / total : 0,
    colorVar,
  });
  return {
    total,
    slices: [
      slice("positive", "Positive", pos, "var(--senti-pos)"),
      slice("neutral", "Neutral", neu, "var(--senti-neu)"),
      slice("negative", "Negative", neg, "var(--senti-neg)"),
    ],
  };
}
