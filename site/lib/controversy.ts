/**
 * Structured controversy record.
 *
 * This is the web twin of `lib/core/domain/models/controversy.dart`. It
 * exists so the marketing/reference site can render the same typed,
 * sourced, dated, severity-scored records the app does, and feed them to
 * the shared Controversy Index in `controversy-index.ts`.
 *
 * Keep the category list, the status list, and both `normalize` functions
 * in step with the Dart file. A change here needs the same change there,
 * plus a matching test case in both suites.
 */

export const CONTROVERSY_CATEGORIES = [
  "Legal",
  "Financial",
  "Social media",
  "Personal conduct",
  "Political",
  "Professional",
  "Relationships",
  "Other",
] as const;

export type ControversyCategory = (typeof CONTROVERSY_CATEGORIES)[number];

export const CONTROVERSY_STATUSES = [
  "ongoing",
  "resolved",
  "historical",
] as const;

export type ControversyStatus = (typeof CONTROVERSY_STATUSES)[number];

export interface Controversy {
  /** Short headline for the episode. */
  title: string;
  /** One to three neutral sentences describing what happened. */
  summary: string;
  category: ControversyCategory;
  /** 1 (minor backlash) to 5 (major scandal with lasting consequences). */
  severity: number;
  status: ControversyStatus;
  /** Approximate year the episode began, when known. */
  year?: number;
  /** Publication names or URLs backing the entry. */
  sources: string[];
}

/**
 * Normalises an arbitrary category string to one of
 * {@link CONTROVERSY_CATEGORIES}, falling back to "Other". Mirrors
 * `ControversyCategory.normalize` in the Dart model, including the loose
 * keyword matching for near-misses.
 */
export function normalizeCategory(raw?: string | null): ControversyCategory {
  if (raw == null) return "Other";
  const lower = raw.toLowerCase();
  for (const c of CONTROVERSY_CATEGORIES) {
    if (c.toLowerCase() === lower) return c;
  }
  if (
    lower.includes("law") ||
    lower.includes("court") ||
    lower.includes("lawsuit")
  ) {
    return "Legal";
  }
  if (
    lower.includes("money") ||
    lower.includes("tax") ||
    lower.includes("fraud")
  ) {
    return "Financial";
  }
  if (
    lower.includes("tweet") ||
    lower.includes("post") ||
    lower.includes("online")
  ) {
    return "Social media";
  }
  if (lower.includes("politic") || lower.includes("election")) {
    return "Political";
  }
  if (
    lower.includes("work") ||
    lower.includes("career") ||
    lower.includes("set")
  ) {
    return "Professional";
  }
  if (
    lower.includes("relationship") ||
    lower.includes("divorce") ||
    lower.includes("affair")
  ) {
    return "Relationships";
  }
  return "Other";
}

/** Mirrors `ControversyStatus.normalize` in the Dart model. */
export function normalizeStatus(raw?: string | null): ControversyStatus {
  const lower = (raw ?? "").toLowerCase();
  if (
    lower.includes("ongoing") ||
    lower.includes("active") ||
    lower.includes("current")
  ) {
    return "ongoing";
  }
  if (
    lower.includes("resolved") ||
    lower.includes("settled") ||
    lower.includes("over")
  ) {
    return "resolved";
  }
  return "historical";
}

export function isOngoing(c: Controversy): boolean {
  return c.status === "ongoing";
}

/**
 * Parses an untrusted record into a {@link Controversy}, clamping severity
 * to 1..5 and normalising the enums. Mirrors `Controversy.fromMap`.
 */
export function parseControversy(raw: Record<string, unknown>): Controversy {
  const title =
    typeof raw.title === "string" && raw.title.trim().length > 0
      ? raw.title.trim()
      : "Untitled controversy";
  const summary =
    typeof raw.summary === "string" ? raw.summary.trim() : "";
  const severityRaw =
    typeof raw.severity === "number" ? Math.trunc(raw.severity) : 1;
  const severity = Math.min(5, Math.max(1, severityRaw));
  const year =
    typeof raw.year === "number" ? Math.trunc(raw.year) : undefined;
  const sources = Array.isArray(raw.sources)
    ? raw.sources.map((s) => String(s).trim()).filter((s) => s.length > 0)
    : [];
  return {
    title,
    summary,
    category: normalizeCategory(
      typeof raw.category === "string" ? raw.category : null,
    ),
    severity,
    status: normalizeStatus(
      typeof raw.status === "string" ? raw.status : null,
    ),
    year,
    sources,
  };
}

/**
 * The corroboration gate, mirrored for the site. A severity 4 or 5 claim
 * with no backing source is dropped rather than rendered, exactly as the
 * backend's `corroborate.js` does before the record is ever stored.
 */
export function passesCorroborationGate(c: Controversy): boolean {
  if (c.severity >= 4) return c.sources.length > 0;
  return true;
}

/** Applies {@link passesCorroborationGate} across a list. */
export function corroborated(items: Controversy[]): Controversy[] {
  return items.filter(passesCorroborationGate);
}
