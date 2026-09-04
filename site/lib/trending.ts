/**
 * Pure parsing for the trending rail — the figures people on this
 * deployment have looked up most. The backend's `GET /trending` returns
 * `{ figures: [...] }`; this maps the untrusted JSON onto a strict shape
 * and drops anything malformed rather than rendering a half-empty card.
 *
 * The list is deliberately allowed to be empty: a fresh deployment has
 * nothing measured, and an empty rail is honest where a hard-coded list
 * of famous names would be a claim about users that nothing supports.
 */

export interface TrendingFigure {
  slug: string;
  name: string;
  requestCount: number;
  sentimentScore: number | null;
  trendDirection: "up" | "down" | "stable";
  imageUrl: string | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function direction(v: unknown): TrendingFigure["trendDirection"] {
  return v === "up" || v === "down" ? v : "stable";
}

/** Parses one row; returns null if it has no usable slug. */
export function parseTrendingFigure(v: unknown): TrendingFigure | null {
  if (!isRecord(v)) return null;
  const slug = typeof v.slug === "string" ? v.slug.trim() : "";
  if (!slug) return null;
  const count =
    typeof v.requestCount === "number" && Number.isFinite(v.requestCount)
      ? Math.max(0, Math.round(v.requestCount))
      : 0;
  return {
    slug,
    name: typeof v.name === "string" && v.name ? v.name : slug,
    requestCount: count,
    sentimentScore:
      typeof v.sentimentScore === "number" && Number.isFinite(v.sentimentScore)
        ? v.sentimentScore
        : null,
    trendDirection: direction(v.trendDirection),
    imageUrl:
      typeof v.imageUrl === "string" && v.imageUrl ? v.imageUrl : null,
  };
}

/**
 * Parses the whole `GET /trending` body into a clean, ranked list.
 * Re-sorts by `requestCount` so the order does not depend on the
 * backend's, and caps the length.
 */
export function parseTrending(raw: unknown, limit = 12): TrendingFigure[] {
  const root = isRecord(raw) ? raw : {};
  const figures = Array.isArray(root.figures) ? root.figures : [];
  return figures
    .map(parseTrendingFigure)
    .filter((f): f is TrendingFigure => f !== null)
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, Math.max(1, limit));
}
