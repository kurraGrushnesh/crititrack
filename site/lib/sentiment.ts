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
