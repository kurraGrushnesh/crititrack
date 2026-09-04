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
