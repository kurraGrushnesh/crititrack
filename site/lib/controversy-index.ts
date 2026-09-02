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
    // Severity 1..5 -> 0.2..1.0
    let w = c.severity / 5;

    // Recency: <=2y old keeps full weight, then decays to a 0.4 floor.
    if (c.year != null) {
      const age = clamp(year - c.year, 0, 40);
      if (age > 2) {
        w *= clamp(1 - (age - 2) * 0.06, 0.4, 1);
      }
    } else {
      w *= 0.7; // unknown date -> mild discount
    }

    // Unresolved episodes carry more weight.
    if (isOngoing(c)) w *= 1.25;

    weighted += w;
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

function labelFor(score: number): string {
  if (score < 15) return "Low profile";
  if (score < 35) return "Occasionally criticized";
  if (score < 55) return "Frequently debated";
  if (score < 75) return "Highly controversial";
  return "Lightning rod";
}
