/**
 * Deterministic "Controversy Index" -- a 0-100 score summarising how
 * controversial a public figure is, derived entirely from the structured
 * {@link Controversy} list.
 *
 * This is the TypeScript twin of `lib/core/utils/controversy_index.dart`.
 * Both clients must agree on the same input and produce the same number,
 * so the formula, the recency decay, the diminishing-returns curve, and
 * the label bands below are copied from the Dart file line for line. A
 * change to any constant here needs the identical change in Dart, plus a
 * matching case in both test suites.
 *
 * It is computed locally rather than asked from a language model so that
 * it is reproducible, unit-testable, and free. The score rises with
 * higher individual severities, more distinct episodes (with diminishing
 * returns), unresolved status, and recency.
 */

import type { Controversy } from "./controversy";
import { isOngoing } from "./controversy";

/**
 * The formal version of the CritiScore calculation below — bumped only
 * when the formula, curve or a constant in this file changes. "2.0"
 * marks the Step 9 "CritiScore 2.0" presentation/transparency upgrade;
 * the underlying arithmetic (severity × recency × unresolved, then the
 * diminishing-returns curve) is unchanged since it shipped, so this is
 * the first formally tracked version rather than a claim of prior
 * numbered releases.
 */
export const CRITISCORE_METHODOLOGY_VERSION = "2.0";

export interface ControversyIndex {
  /** 0-100. */
  score: number;
  /** Human-readable band for {@link score}. */
  label: string;
  /** How many episodes are currently unresolved. */
  ongoingCount: number;
  /** Highest single-episode severity (0 when the list is empty). */
  peakSeverity: number;
  /** Number of episodes considered. */
  total: number;
}

export function roundedScore(index: ControversyIndex): number {
  return Math.round(index.score);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Computes the index for `items`. `currentYear` is injectable for tests;
 * it defaults to the current calendar year, matching the Dart default.
 */
export function computeControversyIndex(
  items: Controversy[],
  currentYear?: number,
): ControversyIndex {
  if (items.length === 0) {
    return {
      score: 0,
      label: "No documented controversies",
      ongoingCount: 0,
      peakSeverity: 0,
      total: 0,
    };
  }

  const year = currentYear ?? new Date().getFullYear();

  let weighted = 0;
  for (const c of items) {
    weighted += episodeContribution(c, year).weight;
  }

  // Diminishing-returns curve: one severe recent episode ~= 50, several
  // push the score toward (but never reach) 100.
  const score = clamp(100 * (1 - 1 / (1 + weighted)), 0, 100);

  const peak = items.reduce((a, c) => (c.severity > a ? c.severity : a), 0);
  const ongoing = items.filter(isOngoing).length;

  return {
    score,
    label: labelFor(score),
    ongoingCount: ongoing,
    peakSeverity: peak,
    total: items.length,
  };
}

/**
 * How one episode contributes to the pre-curve weighted sum, broken into
 * its factors. This is the single source of truth for the per-item
 * weight — {@link computeControversyIndex} sums `weight` and
 * {@link explainControversyIndex} shows the parts.
 */
export interface EpisodeContribution {
  /** 0.2..1.0 — severity / 5. */
  severityBase: number;
  /** 0.4..1.0 for a dated episode; 0.7 for an undated one. */
  recencyFactor: number;
  /** 1.25 when unresolved, else 1.0. */
  ongoingFactor: number;
  /** severityBase * recencyFactor * ongoingFactor. */
  weight: number;
}

export function episodeContribution(
  c: Controversy,
  year: number,
): EpisodeContribution {
  const severityBase = c.severity / 5;

  let recencyFactor = 1;
  if (c.year != null) {
    const age = clamp(year - c.year, 0, 40);
    if (age > 2) recencyFactor = clamp(1 - (age - 2) * 0.06, 0.4, 1);
  } else {
    recencyFactor = 0.7;
  }

  const ongoingFactor = isOngoing(c) ? 1.25 : 1;

  return {
    severityBase,
    recencyFactor,
    ongoingFactor,
    weight: severityBase * recencyFactor * ongoingFactor,
  };
}

export interface IndexExplanationRow extends EpisodeContribution {
  title: string;
  year: number | null;
  severity: number;
  ongoing: boolean;
  /** This episode's share of the final score, in points. */
  points: number;
}

export interface IndexExplanation {
  score: number;
  label: string;
  /** Sum of every episode's pre-curve weight. */
  totalWeight: number;
  /** Plain-language description of the compression curve. */
  curve: string;
  rows: IndexExplanationRow[];
}

/**
 * The same computation as {@link computeControversyIndex}, but returning
 * the per-episode arithmetic behind the number so a UI can show "why".
 *
 * `points` attributes the final (post-curve) score across episodes in
 * proportion to their pre-curve weight, so the rows sum to the score and
 * a reader can see which episode drove it.
 */
export function explainControversyIndex(
  items: Controversy[],
  currentYear?: number,
): IndexExplanation {
  const index = computeControversyIndex(items, currentYear);
  const year = currentYear ?? new Date().getFullYear();

  const contributions = items.map((c) => ({
    c,
    contribution: episodeContribution(c, year),
  }));
  const totalWeight = contributions.reduce(
    (t, x) => t + x.contribution.weight,
    0,
  );

  const rows: IndexExplanationRow[] = contributions.map(({ c, contribution }) => ({
    ...contribution,
    title: c.title,
    year: c.year ?? null,
    severity: c.severity,
    ongoing: isOngoing(c),
    points:
      totalWeight > 0 ? (contribution.weight / totalWeight) * index.score : 0,
  }));

  rows.sort((a, b) => b.points - a.points);

  return {
    score: index.score,
    label: index.label,
    totalWeight,
    curve:
      "Weights are summed, then compressed by 100 · (1 − 1 / (1 + sum)): " +
      "one severe recent episode lands near 50, and more episodes push " +
      "toward but never reach 100.",
    rows,
  };
}

function labelFor(score: number): string {
  if (score < 15) return "Low profile";
  if (score < 35) return "Occasionally criticized";
  if (score < 55) return "Frequently debated";
  if (score < 75) return "Highly controversial";
  return "Lightning rod";
}

// ── STEP 9: CritiScore 2.0 — presentation, transparency, history ───────
//
// Everything below is derived arithmetic over the same structured
// `Controversy[]` the score itself comes from. No network call, no model,
// no new stored data: history and "previous score" are honest recomputes
// over the episodes' own recorded years, clearly presented as that rather
// than as a live-tracked snapshot the app never took.

/** The standardised comparison band the spec asks for, independent of
 * the more evocative `label` above (which stays for the descriptive
 * line; `band` is for comparing figures on a common scale). */
export type ScoreBand = "Very Low" | "Low" | "Moderate" | "High" | "Very High";

export interface ScoreBandInfo {
  band: ScoreBand;
  min: number;
  max: number;
}

const BANDS: { band: ScoreBand; min: number; max: number }[] = [
  { band: "Very Low", min: 0, max: 19 },
  { band: "Low", min: 20, max: 39 },
  { band: "Moderate", min: 40, max: 59 },
  { band: "High", min: 60, max: 79 },
  { band: "Very High", min: 80, max: 100 },
];

export function scoreBand(score: number): ScoreBandInfo {
  const s = clamp(score, 0, 100);
  const hit = BANDS.find((b) => s >= b.min && s <= b.max) ?? BANDS[BANDS.length - 1];
  return { band: hit.band, min: hit.min, max: hit.max };
}

export type ConfidenceLevel = "High" | "Medium" | "Low";

export interface IndexConfidence {
  level: ConfidenceLevel;
  /** Fraction (0..1) of episodes backed by at least one source. */
  sourcedRatio: number;
  /** Fraction (0..1) of episodes with a recorded year. */
  datedRatio: number;
  /** A plain-language reason built from the two ratios above. */
  reason: string;
}

/**
 * How well-supported the score's inputs are — not a model's confidence in
 * itself, a count of how many episodes are sourced and dated. Every
 * severity-4/5 episode is already required to have a source by the
 * corroboration gate (`passesCorroborationGate`); this shows that
 * coverage rather than asserting a feeling about the number.
 *
 * Returns null for an empty list — there is nothing to rate.
 */
export function indexConfidence(items: Controversy[]): IndexConfidence | null {
  if (items.length === 0) return null;

  const sourced = items.filter((c) => c.sources.length > 0).length;
  const dated = items.filter((c) => c.year != null).length;
  const sourcedRatio = sourced / items.length;
  const datedRatio = dated / items.length;

  const level: ConfidenceLevel =
    sourcedRatio >= 0.8 && datedRatio >= 0.8
      ? "High"
      : sourcedRatio >= 0.5 && datedRatio >= 0.5
        ? "Medium"
        : "Low";

  const n = items.length;
  const reason =
    `${sourced} of ${n} episode${n === 1 ? "" : "s"} sourced, ` +
    `${dated} of ${n} dated`;

  return { level, sourcedRatio, datedRatio, reason };
}

/**
 * The index as it would read if computed at the end of `asOfYear` —
 * episodes dated after that year are excluded (an undated episode's
 * timing is unknown, so it is kept in every year rather than guessed
 * into one). Recency is measured from `asOfYear`, not the real present.
 *
 * This is a genuine recomputation over real, already-dated data — not a
 * stored snapshot the app took at the time. Callers must present it as
 * a reconstruction (see `IndexChange`/`IndexHistory` below), not as
 * "the score on that day."
 */
export function indexAsOf(items: Controversy[], asOfYear: number): ControversyIndex {
  const known = items.filter((c) => c.year == null || c.year <= asOfYear);
  return computeControversyIndex(known, asOfYear);
}

export interface IndexChange {
  current: number;
  previous: number;
  previousYear: number;
  delta: number;
}

/**
 * Current score vs. a reconstruction as of the end of the prior year.
 * Null when there is nothing to compare against — every episode is
 * either undated or from `currentYear` itself, so a "previous" figure
 * would not mean anything.
 */
export function indexChange(
  items: Controversy[],
  currentYear?: number,
): IndexChange | null {
  const year = currentYear ?? new Date().getFullYear();
  const hasEarlierDated = items.some((c) => c.year != null && c.year < year);
  if (!hasEarlierDated) return null;

  const current = computeControversyIndex(items, year).score;
  const previous = indexAsOf(items, year - 1).score;
  return { current, previous, previousYear: year - 1, delta: current - previous };
}

export interface IndexHistoryPoint {
  year: number;
  score: number;
}

/**
 * A year-by-year reconstruction from the earliest dated episode through
 * `currentYear`. Empty when there are fewer than two distinct dated
 * years to show a shape across — a flat one-point "history" is not a
 * history, and this deliberately returns nothing rather than a
 * misleadingly flat line for a person with only one dated episode.
 */
export function indexHistory(
  items: Controversy[],
  currentYear?: number,
): IndexHistoryPoint[] {
  const year = currentYear ?? new Date().getFullYear();
  const years = [...new Set(items.map((c) => c.year).filter((y): y is number => y != null))];
  if (years.length < 2) return [];

  const start = Math.min(...years);
  const points: IndexHistoryPoint[] = [];
  for (let y = start; y <= year; y++) {
    points.push({ year: y, score: indexAsOf(items, y).score });
  }
  return points;
}
