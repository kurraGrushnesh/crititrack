/**
 * One vocabulary for "how much should you trust this number", used
 * wherever the site shows an assessed value: the sentiment confidence
 * band, the precision of a Wikidata fact, and whether a controversy was
 * corroborated by retrieved coverage.
 *
 * Before this, each section spoke its own dialect — "Low confidence", a
 * grey "year only" note, a "corroborated" tick — so a reader had to learn
 * three scales. This collapses them to three levels with consistent
 * label, icon and gloss.
 */

export type ConfidenceLevel = "high" | "moderate" | "low";

export interface ConfidenceBadge {
  level: ConfidenceLevel;
  label: string;
  /** A single glyph name the UI maps to an icon; also fine as text. */
  icon: "check-double" | "check" | "dash";
  /** One sentence a tooltip can show. */
  gloss: string;
}

const BADGES: Record<ConfidenceLevel, Omit<ConfidenceBadge, "gloss">> = {
  high: { level: "high", label: "High confidence", icon: "check-double" },
  moderate: { level: "moderate", label: "Moderate confidence", icon: "check" },
  low: { level: "low", label: "Low confidence", icon: "dash" },
};

function badge(level: ConfidenceLevel, gloss: string): ConfidenceBadge {
  return { ...BADGES[level], gloss };
}

/** The sentiment ensemble's 0..1 confidence. Thresholds match sentiment.ts. */
export function sentimentConfidence(confidence: number): ConfidenceBadge {
  if (!Number.isFinite(confidence)) {
    return badge("low", "Confidence could not be computed.");
  }
  if (confidence >= 0.75) {
    return badge(
      "high",
      "The three methods agree and the sample is healthy — take the number at face value.",
    );
  }
  if (confidence >= 0.5) {
    return badge(
      "moderate",
      "The methods mostly line up. Read the number as a solid estimate.",
    );
  }
  return badge(
    "low",
    "The methods disagree, or too few items were found. Read the number as a rough direction.",
  );
}

/**
 * A Wikidata fact's stated precision. Wikidata reports how precise a date
 * is; a "day"-precision birth date is trustworthy, a "year" one should
 * not be rendered as a specific day.
 */
export type FactPrecision =
  | "day"
  | "month"
  | "year"
  | "decade"
  | "century"
  | "unknown";

export function factConfidence(precision: FactPrecision): ConfidenceBadge {
  switch (precision) {
    case "day":
      return badge("high", "Wikidata records this to the day.");
    case "month":
      return badge("moderate", "Wikidata records this only to the month.");
    case "year":
      return badge("moderate", "Wikidata records this only to the year.");
    default:
      return badge(
        "low",
        "Wikidata records this only approximately; treat it as a rough era.",
      );
  }
}

/**
 * Whether a controversy record was supported by retrieved coverage. A
 * severity 4–5 claim with no support is dropped before display, so a
 * shown-but-uncorroborated record is always minor.
 */
export function corroborationConfidence(
  corroborated: boolean,
  severity: number,
): ConfidenceBadge {
  if (corroborated) {
    return badge("high", "At least one retrieved article supports this record.");
  }
  return badge(
    "low",
    severity >= 4
      ? "Not supported by retrieved coverage — a claim this serious would have been dropped."
      : "No retrieved article mentions this; it is shown because it is minor.",
  );
}
