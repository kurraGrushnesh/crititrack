/**
 * A versioned record of changes to how CritiTrack computes what it shows.
 *
 * Why this exists: a share card, an export or a screenshot taken today
 * carries numbers produced by today's formulas. If the recency decay or
 * the ensemble weighting changes next month, an old artifact should be
 * readable as "computed under method v3", not silently wrong. The current
 * version stamps every share card and export.
 *
 * Each entry is append-only. Bump `version` and add an entry in the same
 * change that alters a constant in controversy-index.ts, sentiment.ts,
 * reach.ts or the corroboration gate.
 */

export interface MethodologyChange {
  version: number;
  /** ISO date the change shipped. */
  date: string;
  /**
   * True when `date` is reconstructed from the project history rather
   * than recorded at the time. Only v4 onward is exact.
   */
  approxDate?: boolean;
  /** One-line summary, plain language. */
  summary: string;
  /** The areas touched, for filtering. */
  areas: Array<
    "sentiment" | "controversy-index" | "corroboration" | "sources" | "attention"
  >;
}

/** Newest first. */
export const METHODOLOGY_CHANGES: readonly MethodologyChange[] = [
  {
    version: 4,
    date: "2026-09-04",
    summary:
      "Reddit discussion added as a fourth source, weighted below news; " +
      "routinely-unreliable tabloids down-weighted in the aggregate.",
    areas: ["sources", "sentiment"],
  },
  {
    version: 3,
    date: "2026-08-20",
    approxDate: true,
    summary:
      "Sentiment moved to a three-method ensemble (general lexicon, " +
      "reputation lexicon, batched LLM) with a disagreement-derived " +
      "confidence band.",
    areas: ["sentiment"],
  },
  {
    version: 2,
    date: "2026-08-06",
    approxDate: true,
    summary:
      "Controversy Index gained recency decay and a diminishing-returns " +
      "curve; the corroboration gate now runs on both server and client.",
    areas: ["controversy-index", "corroboration"],
  },
  {
    version: 1,
    date: "2026-07-22",
    approxDate: true,
    summary:
      "First public method: deterministic Controversy Index from typed " +
      "records; single-method sentiment; Wikipedia pageviews as a " +
      "separate attention series.",
    areas: ["controversy-index", "sentiment", "attention"],
  },
] as const;

/** The version new artifacts are stamped with. */
export const CURRENT_METHODOLOGY_VERSION: number =
  METHODOLOGY_CHANGES[0].version;

/** The change entry for a given version, or null. */
export function methodologyChange(version: number): MethodologyChange | null {
  return METHODOLOGY_CHANGES.find((c) => c.version === version) ?? null;
}

/** Short stamp for a share card / export footer, e.g. "Method v4 · 2026-09-04". */
export function methodologyStamp(
  version: number = CURRENT_METHODOLOGY_VERSION,
): string {
  const change = methodologyChange(version);
  return change ? `Method v${version} · ${change.date}` : `Method v${version}`;
}
