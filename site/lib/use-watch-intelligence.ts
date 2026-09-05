"use client";

import { useMemo } from "react";
import { useCelebrity } from "./use-celebrity";
import { buildTimeline } from "./timeline";
import { detectChanges, type ChangeEvent } from "./changes";
import { buildWatchOverview, importantNewsFromTimeline, type WatchOverview } from "./watch-intelligence";
import type { RealProfile } from "./api";
import type { TimelineEvent } from "./timeline";
import type { WatchEntry } from "./watchlist";

export type WatchIntelligenceState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string; canRetry: boolean }
  | {
      status: "ready";
      profile: RealProfile;
      changes: ChangeEvent[];
      timeline: TimelineEvent[];
      importantNews: TimelineEvent[];
      overview: WatchOverview;
    };

/**
 * One watched entity's intelligence: fetches its profile through the
 * exact same path a profile page uses (`useCelebrity` — real API call,
 * App Check, the browser's own last-seen cache), then layers Step 15/16
 * Change Detection, the Timeline's news grouping and the Watch
 * Intelligence summary on top. No new fetch, no second detection engine.
 */
export function useWatchIntelligence(entry: WatchEntry): WatchIntelligenceState {
  const { state } = useCelebrity(entry.name, entry.wikidataId);

  const derived = useMemo(() => {
    if (state.status !== "ready") return null;
    const { profile, previousProfile } = state;

    const changes = previousProfile ? detectChanges(previousProfile, profile, profile.fetchedAt) : [];
    const timeline = buildTimeline({
      controversies: profile.controversies,
      media: profile.media,
      career: profile.career.timeline,
      attentionSeries: profile.attention?.series ?? [],
      trend: profile.trend,
      changeEvents: changes,
    });
    const overview = buildWatchOverview(profile, changes, entry.lastSeenChangeAt);
    const importantNews = importantNewsFromTimeline(timeline);

    return { profile, changes, timeline, importantNews, overview };
  }, [state, entry.lastSeenChangeAt]);

  if (state.status === "idle" || state.status === "loading") return { status: state.status };
  if (state.status === "not-found") return { status: "not-found", message: state.message };
  if (state.status === "error") return { status: "error", message: state.message, canRetry: state.canRetry };
  if (!derived) return { status: "loading" };
  return { status: "ready", ...derived };
}
