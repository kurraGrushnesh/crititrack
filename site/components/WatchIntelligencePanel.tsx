"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useWatchIntelligence } from "@/lib/use-watch-intelligence";
import type { WatchEntry } from "@/lib/watchlist";
import { markWatchViewed, markWatchChangesSeen } from "./watchlist-store";
import ChangeHistory from "./ChangeHistory";
import { relativeTime } from "@/lib/time";
import { profileLink } from "@/lib/deep-link";

/**
 * A watched entity's Watch Intelligence — opened from its row on the
 * watchlist. An intelligence feed over the entity's existing profile
 * data, not a second profile page: Overview, Recent Changes (the exact
 * same ChangeHistory the profile page uses), Important News (the
 * Timeline's own deduplicated news groups), and Sentiment/CritiScore/
 * Attention summaries read straight off the fetched profile.
 *
 * Opening this panel is what marks its changes "seen" — never the
 * watchlist row simply rendering.
 */
export default function WatchIntelligencePanel({ entry }: { entry: WatchEntry }) {
  const state = useWatchIntelligence(entry);

  useEffect(() => {
    if (state.status !== "ready") return;
    const now = Date.now();
    markWatchViewed(entry.slug, now);
    if (state.changes.length > 0) markWatchChangesSeen(entry.slug, now);
    // Only when this panel actually renders ready data for this entry —
    // never on every watchlist render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status === "ready", entry.slug]);

  if (state.status === "idle" || state.status === "loading") {
    return (
      <div className="wi-skeleton" aria-busy="true">
        <div className="wi-skeleton-line" style={{ width: "60%" }} />
        <div className="wi-skeleton-line" style={{ width: "90%" }} />
        <div className="wi-skeleton-line" style={{ width: "75%" }} />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <p className="state-block">{state.message}</p>;
  }

  if (state.status === "error") {
    return (
      <p className="state-block">
        <span className="sb-title">Watch intelligence is temporarily unavailable</span>
        {state.message}
      </p>
    );
  }

  const { profile, changes, importantNews, overview } = state;

  return (
    <div className="wi-panel">
      <div className="wi-overview">
        <div className="wi-overview-stat">
          <span className="wi-overview-label">CritiScore</span>
          <span className="wi-overview-value">{overview.critiscore}</span>
          <span className="wi-overview-sub">{overview.critiscoreLabel}</span>
        </div>
        <div className="wi-overview-stat">
          <span className="wi-overview-label">Sentiment</span>
          <span className="wi-overview-value wi-cap">{overview.sentimentBand}</span>
          <span className="wi-overview-sub">Trend: {overview.sentimentDirection}</span>
        </div>
        <div className="wi-overview-stat">
          <span className="wi-overview-label">Unseen</span>
          <span className="wi-overview-value">{overview.unseenCount}</span>
          <span className="wi-overview-sub">{overview.importantUnseenCount} important</span>
        </div>
      </div>

      {overview.lastMeaningfulUpdate && (
        <p className="wi-last-update">
          Most recent: {overview.lastMeaningfulUpdate}
          {overview.lastMeaningfulUpdateAt && ` · ${relativeTime(overview.lastMeaningfulUpdateAt)}`}
        </p>
      )}

      <section className="wi-section">
        <h4>Recent Changes</h4>
        {changes.length === 0 ? (
          <p className="cv-empty">
            No meaningful changes since your last review. CritiTrack compares against the last
            version this browser saw of this profile.
          </p>
        ) : (
          <ChangeHistory changes={changes} />
        )}
      </section>

      <section className="wi-section">
        <h4>Important News</h4>
        {importantNews.length === 0 ? (
          <p className="cv-empty">No grouped news events found for this profile yet.</p>
        ) : (
          <ul className="wi-news-list">
            {importantNews.map((n, i) => (
              <li key={i} className="wi-news-item">
                <span className="wi-news-title">{n.title}</span>
                <span className="wi-news-meta">
                  {n.sourceCount ?? 1} source{(n.sourceCount ?? 1) === 1 ? "" : "s"}
                  {n.sentimentImpact != null && ` · avg. sentiment ${n.sentimentImpact}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="wi-links">
        <Link href={profileLink(profile.name, "evidence-explorer")}>View evidence →</Link>
        <Link href={profileLink(profile.name, "timeline")}>Full timeline →</Link>
        <Link href={profileLink(profile.name)}>Open profile →</Link>
      </p>
    </div>
  );
}
