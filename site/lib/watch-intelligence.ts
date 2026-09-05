/**
 * Watch Intelligence — turns the existing Watch button/watchlist into an
 * evidence-backed feed for a watched entity, by reading the systems that
 * already exist: Step 16's ChangeEvents, the Intelligent Timeline's news
 * grouping, the deterministic CritiScore, the three-method sentiment
 * ensemble, and Data Coverage. Nothing here recalculates any of those —
 * it filters, sorts, and packages their existing output for a compact
 * feed, and tracks what a reader has already seen.
 *
 * This is not a second Change Detection engine: `detectChanges` (Step
 * 15/16) is still the only place a ChangeEvent is produced. This module
 * only decides which of the already-detected events to show, in what
 * order, and whether they are new to the reader.
 */

import type { ChangeEvent, ChangeSeverity, ChangeConfidence } from "./changes";
import type { RealProfile } from "./api";
import type { TimelineEvent } from "./timeline";
import { computeControversyIndex } from "./controversy-index";
import { sentimentBand, type SentimentBand } from "./sentiment";
import type {
  WatchFilters,
  MinimumSeverity,
  MinimumConfidence,
  WatchTimeRange,
} from "./watchlist";

// ── Filtering ────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<ChangeSeverity, number> = { INFO: 0, MINOR: 1, SIGNIFICANT: 2, MAJOR: 3 };
const CONFIDENCE_RANK: Record<ChangeConfidence, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const RANGE_DAYS: Record<Exclude<WatchTimeRange, "all">, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };

export function filterBySeverity(changes: ChangeEvent[], minimum: MinimumSeverity): ChangeEvent[] {
  if (minimum === "ALL") return changes;
  return changes.filter((c) => SEVERITY_RANK[c.severity] >= SEVERITY_RANK[minimum]);
}

export function filterByConfidence(changes: ChangeEvent[], minimum: MinimumConfidence): ChangeEvent[] {
  if (minimum === "ALL") return changes;
  return changes.filter((c) => CONFIDENCE_RANK[c.confidence] >= CONFIDENCE_RANK[minimum]);
}

/** `now` is a parameter (not read internally) so this stays a pure
 * function of its arguments — see `timeline.ts`'s `withinRangeDays` for
 * the same pattern and reasoning. */
export function filterByTimeRange(changes: ChangeEvent[], range: WatchTimeRange, now: number): ChangeEvent[] {
  if (range === "all") return changes;
  const days = RANGE_DAYS[range];
  const cutoff = now - days * 86_400_000;
  return changes.filter((c) => Date.parse(c.detectedAt) >= cutoff);
}

/** Applies a watch's stored filters together, in one pass. */
export function applyWatchFilters(changes: ChangeEvent[], filters: WatchFilters, now: number): ChangeEvent[] {
  let out = filterBySeverity(changes, filters.minimumSeverity);
  out = filterByConfidence(out, filters.minimumConfidence);
  out = filterByTimeRange(out, filters.timeRange, now);
  return out;
}

/** The default feed view the spec asks for: MAJOR + SIGNIFICANT only,
 * unless the watch's own preferences turn that off. */
export function importantChanges(changes: ChangeEvent[]): ChangeEvent[] {
  return changes.filter((c) => c.severity === "MAJOR" || c.severity === "SIGNIFICANT");
}

// ── Unseen tracking ──────────────────────────────────────────────────

/** Changes detected after `lastSeenChangeAt` (epoch ms) — everything, if
 * the watch has never had its changes marked seen. */
export function unseenChanges(changes: ChangeEvent[], lastSeenChangeAt: number | null): ChangeEvent[] {
  if (lastSeenChangeAt == null) return changes;
  return changes.filter((c) => Date.parse(c.detectedAt) > lastSeenChangeAt);
}

// ── Overview ─────────────────────────────────────────────────────────

export interface WatchOverview {
  critiscore: number;
  critiscoreLabel: string;
  sentimentBand: SentimentBand;
  /** "up"/"down"/"stable" vs. the profile's own reported trend
   * direction — reused, never recomputed. */
  sentimentDirection: RealProfile["trendDirection"];
  unseenCount: number;
  importantUnseenCount: number;
  recentChangeCount: number;
  /** The most recent change's title, when there is one — the compact
   * card's "Recent activity" line. Null on a quiet watch. */
  lastMeaningfulUpdate: string | null;
  lastMeaningfulUpdateAt: string | null;
}

export function buildWatchOverview(
  profile: RealProfile,
  changes: ChangeEvent[],
  lastSeenChangeAt: number | null,
): WatchOverview {
  const index = computeControversyIndex(profile.controversies);
  const unseen = unseenChanges(changes, lastSeenChangeAt);
  const important = importantChanges(changes);
  const importantUnseen = unseenChanges(important, lastSeenChangeAt);
  const mostRecent = [...changes].sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1))[0] ?? null;

  return {
    critiscore: Math.round(index.score),
    critiscoreLabel: index.label,
    sentimentBand: sentimentBand(profile.sentimentScore),
    sentimentDirection: profile.trendDirection,
    unseenCount: unseen.length,
    importantUnseenCount: importantUnseen.length,
    recentChangeCount: changes.length,
    lastMeaningfulUpdate: mostRecent?.title ?? null,
    lastMeaningfulUpdateAt: mostRecent?.detectedAt ?? null,
  };
}

// ── Important News (reuses the Timeline's own grouped news events) ──

/**
 * The watched entity's news, as already deduplicated and grouped by
 * `buildTimeline`'s `newsEvents` — a real underlying event with many
 * reporting articles becomes one entry with a source count, never one
 * alert per article. This does not re-run any news pipeline; it reads
 * whichever timeline the caller already built for the profile.
 */
export function importantNewsFromTimeline(timeline: TimelineEvent[], limit = 8): TimelineEvent[] {
  return timeline
    .filter((e) => e.kind === "news")
    .sort((a, b) => {
      const bySources = (b.sourceCount ?? 0) - (a.sourceCount ?? 0);
      if (bySources !== 0) return bySources;
      return a.date < b.date ? 1 : -1;
    })
    .slice(0, limit);
}
