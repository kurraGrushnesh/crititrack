/**
 * Historical Intelligence — answers "what has happened to this person
 * over time", not by re-listing the Timeline at greater length but by
 * assembling a genuine composite view across the dimensions that
 * already have real dated history: measured sentiment snapshots
 * (`profile.trend`, from `readSnapshotHistory` — see `functions/lib/store.js`),
 * the deterministic CritiScore reconstruction (`indexHistory`/`indexAsOf`
 * in `controversy-index.ts`), the dated career timeline
 * (`career.ts`), and the Change Detection log (`changes.ts`).
 *
 * Nothing here is a new score, a new fetch, or a new stored collection.
 * Every field on a `HistoricalSnapshot` is either copied from an
 * already-measured point (sentiment) or recomputed deterministically
 * from already-dated records (CritiScore, career, controversy/claim
 * counts) — the same "reconstruction, not a stored snapshot" honesty
 * `controversy-index.ts` already documents for `indexHistory`. Where a
 * dimension has no real anchor at a given point, its field is `null`
 * and that is disclosed, never backfilled or interpolated.
 *
 * CritiTrack has no backend-authoritative full-profile snapshot store
 * (only the daily sentiment snapshots collection). This module is
 * designed so a future server-side `historicalSnapshots` collection
 * (see the spec's suggested `entities/{entityId}/historicalSnapshots/
 * {snapshotId}` shape) could simply replace `buildHistoricalSnapshots`'s
 * client-side reconstruction with reads of stored documents — the
 * `HistoricalSnapshot` shape and every consumer below is written against
 * that eventual shape today, without pretending the store exists yet.
 */

import type { RealProfile } from "./api";
import type { Controversy } from "./controversy";
import type { Claim } from "./claims";
import { titleSlug } from "./claims";
import { indexAsOf, indexHistory, type IndexHistoryPoint } from "./controversy-index";
import type { CareerEntry } from "./career";
import type { ChangeEvent } from "./changes";
import type { CoverageLevel, DataStatus } from "./coverage";

export const HISTORICAL_METHODOLOGY_VERSION = "historical-1";

// ── Snapshot model ──────────────────────────────────────────────────

/**
 * One point in a person's history, anchored to a real measured
 * sentiment-snapshot date. Every other field is an "as of that date"
 * overlay from a different deterministic system, at that system's own
 * real granularity — never invented to match the sentiment date's
 * daily resolution.
 */
export interface HistoricalSnapshot {
  snapshotId: string;
  entityId: string;
  /** The real date this point is anchored to — a measured sentiment
   * snapshot's own date, never a guess. */
  capturedAt: string;
  /** Same as `capturedAt` today (client-side reconstruction has no
   * separate "recorded vs. effective" distinction yet); kept as its own
   * field so a future backend-authoritative snapshot can populate it
   * independently without a shape change. */
  effectiveDate: string;
  /** Which build of this reconstruction produced the row. */
  profileVersion: string;
  /** Deterministic CritiScore reconstruction for `capturedAt`'s
   * calendar year (see `indexAsOf`). Null when there are no
   * controversies to score. Yearly resolution — disclosed via
   * `critiScoreYear`, never presented as a same-day figure. */
  critiScore: number | null;
  critiScoreYear: number | null;
  /** The real measured sentiment score for `capturedAt`. */
  sentimentScore: number;
  sentimentMentions: number;
  /** Career state as of `capturedAt`'s year, from dated `CareerEntry`
   * rows only — null/empty when no dated row starts on or before it. */
  currentRole: string | null;
  organizations: string[];
  /** Controversies dated on or before `capturedAt`'s year, plus any
   * undated ones (their timing is unknown, so they count in every
   * period — same convention as `indexAsOf`). */
  controversyCount: number;
  /** Claims belonging to those controversies. */
  claimCount: number;
  methodologyVersion: string;
}

function yearOf(dateIso: string): number {
  return Number(dateIso.slice(0, 4)) || new Date().getFullYear();
}

function careerAsOf(timeline: CareerEntry[], year: number): { role: string | null; organizations: string[] } {
  const known = timeline.filter((e) => e.start != null && e.start <= year);
  if (known.length === 0) return { role: null, organizations: [] };
  const sorted = [...known].sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  const latest = sorted[sorted.length - 1];
  const role = [latest.role, latest.organization].filter(Boolean).join(", ") || null;
  const organizations = [...new Set(sorted.map((e) => e.organization).filter((o): o is string => !!o))];
  return { role, organizations };
}

function controversiesAsOf(controversies: Controversy[], year: number): Controversy[] {
  return controversies.filter((c) => c.year == null || c.year <= year);
}

/**
 * Builds the reconstructed historical series for a profile. Empty when
 * there are fewer than two measured sentiment snapshots — a single
 * point has no history to show a shape across, matching `indexHistory`'s
 * own "need at least two" convention.
 */
export function buildHistoricalSnapshots(
  profile: Pick<RealProfile, "slug" | "trend" | "controversies" | "career">,
  claims: Claim[],
): HistoricalSnapshot[] {
  const anchors = [...profile.trend]
    .filter((t) => t.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (anchors.length < 2) return [];

  return anchors.map((point) => {
    const year = yearOf(point.date);
    const { role, organizations } = careerAsOf(profile.career.timeline, year);
    const controversiesToDate = controversiesAsOf(profile.controversies, year);
    const claimIds = new Set(controversiesToDate.map((c) => titleSlug(c.title)));
    const claimCount = claims.filter((c) => claimIds.has(c.controversyId)).length;
    const critiScore = controversiesToDate.length > 0 ? indexAsOf(controversiesToDate, year).score : null;

    return {
      snapshotId: `${profile.slug}-${point.date}`,
      entityId: profile.slug,
      capturedAt: point.date,
      effectiveDate: point.date,
      profileVersion: HISTORICAL_METHODOLOGY_VERSION,
      critiScore,
      critiScoreYear: critiScore != null ? year : null,
      sentimentScore: point.score,
      sentimentMentions: point.mentions,
      currentRole: role,
      organizations,
      controversyCount: controversiesToDate.length,
      claimCount,
      methodologyVersion: HISTORICAL_METHODOLOGY_VERSION,
    } satisfies HistoricalSnapshot;
  });
}

// ── Time ranges ───────────────────────────────────────────────────────

export type HistoricalTimeRange = "7d" | "30d" | "90d" | "1y" | "3y" | "5y" | "all";

export const HISTORICAL_RANGE_LABEL: Record<HistoricalTimeRange, string> = {
  "7d": "Past 7 days",
  "30d": "Past 30 days",
  "90d": "Past 90 days",
  "1y": "Past year",
  "3y": "Past 3 years",
  "5y": "Past 5 years",
  all: "All time",
};

const RANGE_DAYS: Record<Exclude<HistoricalTimeRange, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
  "3y": 365 * 3,
  "5y": 365 * 5,
};

export function filterSnapshotsByRange(
  snapshots: HistoricalSnapshot[],
  range: HistoricalTimeRange,
  now: number = Date.now(),
): HistoricalSnapshot[] {
  if (range === "all") return snapshots;
  const cutoff = now - RANGE_DAYS[range] * 86_400_000;
  return snapshots.filter((s) => Date.parse(s.capturedAt) >= cutoff);
}

/**
 * Which ranges are actually worth offering — a period the data cannot
 * support (e.g. "5 years" for a figure tracked for three weeks) is
 * omitted rather than shown empty. "all" is offered whenever there is
 * any history at all.
 */
export function supportedTimeRanges(
  snapshots: HistoricalSnapshot[],
  now: number = Date.now(),
): HistoricalTimeRange[] {
  if (snapshots.length < 2) return [];
  const earliest = Math.min(...snapshots.map((s) => Date.parse(s.capturedAt)));
  const spanDays = (now - earliest) / 86_400_000;
  const ranges: HistoricalTimeRange[] = (Object.keys(RANGE_DAYS) as (keyof typeof RANGE_DAYS)[])
    .filter((r) => spanDays >= RANGE_DAYS[r] * 0.5 && filterSnapshotsByRange(snapshots, r, now).length >= 2)
    .map((r) => r);
  ranges.push("all");
  return ranges;
}

// ── Per-dimension historical coverage ───────────────────────────────

export type HistoricalDimensionKey = "sentiment" | "critiScore" | "career" | "controversies" | "claims";

export const HISTORICAL_DIMENSION_LABEL: Record<HistoricalDimensionKey, string> = {
  sentiment: "Sentiment History",
  critiScore: "CritiScore History",
  career: "Career History",
  controversies: "Controversy History",
  claims: "Claim History",
};

export interface HistoricalDimensionCoverage {
  key: HistoricalDimensionKey;
  label: string;
  level: CoverageLevel;
  status: DataStatus;
  reasons: string[];
}

function dimCoverage(
  key: HistoricalDimensionKey,
  level: CoverageLevel,
  status: DataStatus,
  reasons: string[],
): HistoricalDimensionCoverage {
  return { key, label: HISTORICAL_DIMENSION_LABEL[key], level, status, reasons };
}

/**
 * Coverage for the historical view itself — distinct from
 * `coverage.ts`'s per-dimension report, which rates *current* data. A
 * provider outage today (no fresh news, no fresh sentiment) is never
 * read as "this person has no history" here: coverage is judged only
 * by how much real dated history already exists.
 */
export function buildHistoricalCoverage(
  snapshots: HistoricalSnapshot[],
  history: IndexHistoryPoint[],
  career: CareerEntry[],
  controversies: Controversy[],
  claims: Claim[],
): HistoricalDimensionCoverage[] {
  const n = snapshots.length;
  const sentiment =
    n === 0
      ? dimCoverage("sentiment", "unavailable", "unavailable", ["No measured sentiment history yet."])
      : dimCoverage(
          "sentiment",
          n >= 30 ? "high" : n >= 7 ? "medium" : "low",
          n < 2 ? "insufficient" : "available",
          [`${n} measured snapshot${n === 1 ? "" : "s"}`],
        );

  const critiScore =
    history.length === 0
      ? dimCoverage("critiScore", "unavailable", "unavailable", ["Not enough dated controversies to reconstruct a score history."])
      : dimCoverage(
          "critiScore",
          history.length >= 5 ? "high" : history.length >= 2 ? "medium" : "low",
          "available",
          [`${history.length} year${history.length === 1 ? "" : "s"} reconstructed (${history[0].year}–${history[history.length - 1].year})`],
        );

  const datedCareer = career.filter((e) => e.start != null);
  const careerCov =
    datedCareer.length === 0
      ? dimCoverage("career", "unavailable", "unavailable", ["No dated career entries."])
      : dimCoverage(
          "career",
          datedCareer.length >= 4 ? "high" : datedCareer.length >= 2 ? "medium" : "low",
          "available",
          [`${datedCareer.length} dated role${datedCareer.length === 1 ? "" : "s"}`],
        );

  const controversiesCov =
    controversies.length === 0
      ? dimCoverage("controversies", "unavailable", "unavailable", ["No documented controversies."])
      : dimCoverage(
          "controversies",
          controversies.length >= 5 ? "high" : controversies.length >= 2 ? "medium" : "low",
          "available",
          [`${controversies.length} episode${controversies.length === 1 ? "" : "s"} on record`],
        );

  const claimsCov =
    claims.length === 0
      ? dimCoverage("claims", "unavailable", "unavailable", ["No claims extracted from evidence."])
      : dimCoverage(
          "claims",
          claims.length >= 5 ? "high" : claims.length >= 2 ? "medium" : "low",
          "available",
          [`${claims.length} claim${claims.length === 1 ? "" : "s"} tracked`],
        );

  return [sentiment, critiScore, careerCov, controversiesCov, claimsCov];
}

// ── Major turning points ─────────────────────────────────────────────

export type TurningPointKind = "score" | "career" | "controversy" | "sentiment" | "change";

export interface TurningPoint {
  id: string;
  kind: TurningPointKind;
  date: string;
  title: string;
  summary: string;
  /** Ids of the underlying `ChangeEvent`s or evidence this point is
   * traceable to — always populated, never a bare assertion. */
  relatedChangeId?: string | null;
}

/**
 * Turning points reuse existing real signals only: year-over-year
 * CritiScore reconstruction deltas above a real threshold, dated career
 * transitions, and any MAJOR/SIGNIFICANT `ChangeEvent`s already
 * detected. No new score, no prediction — this is a merge-and-sort over
 * data every other section already shows.
 */
export function majorTurningPoints(
  history: IndexHistoryPoint[],
  career: CareerEntry[],
  changeEvents: ChangeEvent[],
): TurningPoint[] {
  const points: TurningPoint[] = [];

  for (let i = 1; i < history.length; i++) {
    const delta = history[i].score - history[i - 1].score;
    if (Math.abs(delta) < 15) continue;
    points.push({
      id: `score-${history[i].year}`,
      kind: "score",
      date: String(history[i].year),
      title: `CritiScore ${delta > 0 ? "rose" : "fell"} sharply in ${history[i].year}`,
      summary: `Reconstructed score moved from ${Math.round(history[i - 1].score)} to ${Math.round(history[i].score)}.`,
    });
  }

  for (const e of career) {
    if (e.start == null || (!e.role && !e.organization)) continue;
    points.push({
      id: `career-${e.start}-${e.organization ?? e.role}`,
      kind: "career",
      date: String(e.start),
      title: `${[e.role, e.organization].filter(Boolean).join(", ")}`,
      summary: e.current ? "Ongoing since this date." : "A dated career transition.",
    });
  }

  for (const c of changeEvents) {
    if (c.severity !== "MAJOR" && c.severity !== "SIGNIFICANT") continue;
    points.push({
      id: c.changeId,
      kind: c.changeType === "CRITISCORE_CHANGE" ? "score" : c.changeType === "SENTIMENT_CHANGE" ? "sentiment" : c.changeType.startsWith("CONTROVERSY") ? "controversy" : "change",
      date: c.effectiveDate ?? c.detectedAt,
      title: c.title,
      summary: c.summary,
      relatedChangeId: c.changeId,
    });
  }

  return points.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Period comparison ─────────────────────────────────────────────────

export interface PeriodComparison {
  rangeA: HistoricalTimeRange;
  rangeB: HistoricalTimeRange;
  startScoreA: number | null;
  endScoreA: number | null;
  startScoreB: number | null;
  endScoreB: number | null;
  sentimentDeltaA: number | null;
  sentimentDeltaB: number | null;
  controversyCountA: number;
  controversyCountB: number;
}

function summarizeRange(snapshots: HistoricalSnapshot[]): {
  startScore: number | null;
  endScore: number | null;
  sentimentDelta: number | null;
  controversyCount: number;
} {
  if (snapshots.length === 0) {
    return { startScore: null, endScore: null, sentimentDelta: null, controversyCount: 0 };
  }
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  return {
    startScore: first.critiScore,
    endScore: last.critiScore,
    sentimentDelta: last.sentimentScore - first.sentimentScore,
    controversyCount: last.controversyCount,
  };
}

/** Compares two (typically non-overlapping) periods over the same
 * snapshot series — e.g. "this year" vs. "last year". Every field comes
 * from `summarizeRange` over real snapshots; a period with no snapshots
 * reports nulls rather than a fabricated zero. */
export function comparePeriods(
  snapshots: HistoricalSnapshot[],
  rangeA: HistoricalTimeRange,
  rangeB: HistoricalTimeRange,
  now: number = Date.now(),
): PeriodComparison {
  const a = summarizeRange(filterSnapshotsByRange(snapshots, rangeA, now));
  const b = summarizeRange(filterSnapshotsByRange(snapshots, rangeB, now));
  return {
    rangeA,
    rangeB,
    startScoreA: a.startScore,
    endScoreA: a.endScore,
    startScoreB: b.startScore,
    endScoreB: b.endScore,
    sentimentDeltaA: a.sentimentDelta,
    sentimentDeltaB: b.sentimentDelta,
    controversyCountA: a.controversyCount,
    controversyCountB: b.controversyCount,
  };
}

// ── Historical events filter ─────────────────────────────────────────

export type HistoricalEventFilter = "all" | TurningPointKind;

export function filterTurningPoints(points: TurningPoint[], filter: HistoricalEventFilter): TurningPoint[] {
  if (filter === "all") return points;
  return points.filter((p) => p.kind === filter);
}

// ── Historical Overview ───────────────────────────────────────────────

export interface HistoricalOverview {
  entityId: string;
  firstSnapshotDate: string | null;
  latestSnapshotDate: string | null;
  snapshotCount: number;
  supportedRanges: HistoricalTimeRange[];
  coverage: HistoricalDimensionCoverage[];
  turningPoints: TurningPoint[];
  /** True only when there is at least one real snapshot — an entity
   * with zero history gets an explicit empty state, never a fabricated
   * "first known state". */
  hasHistory: boolean;
}

export function buildHistoricalOverview(input: {
  profile: Pick<RealProfile, "slug" | "trend" | "controversies" | "career">;
  claims: Claim[];
  changeEvents: ChangeEvent[];
  now?: number;
}): HistoricalOverview {
  const { profile, claims, changeEvents } = input;
  const now = input.now ?? Date.now();
  const snapshots = buildHistoricalSnapshots(profile, claims);
  const history = indexHistory(profile.controversies);
  const coverage = buildHistoricalCoverage(
    snapshots,
    history,
    profile.career.timeline,
    profile.controversies,
    claims,
  );
  const turningPoints = majorTurningPoints(history, profile.career.timeline, changeEvents);

  return {
    entityId: profile.slug,
    firstSnapshotDate: snapshots[0]?.capturedAt ?? null,
    latestSnapshotDate: snapshots[snapshots.length - 1]?.capturedAt ?? null,
    snapshotCount: snapshots.length,
    supportedRanges: supportedTimeRanges(snapshots, now),
    coverage,
    turningPoints,
    hasHistory: snapshots.length > 0 || history.length > 0 || turningPoints.length > 0,
  };
}
