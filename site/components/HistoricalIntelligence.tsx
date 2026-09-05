"use client";

import { useState } from "react";
import {
  HISTORICAL_METHODOLOGY_VERSION,
  HISTORICAL_RANGE_LABEL,
  filterSnapshotsByRange,
  filterTurningPoints,
  comparePeriods,
  type HistoricalOverview,
  type HistoricalSnapshot,
  type HistoricalTimeRange,
  type HistoricalEventFilter,
  type TurningPointKind,
} from "@/lib/historical";
import type { CoverageLevel } from "@/lib/coverage";

const LEVEL_CLASS: Record<CoverageLevel, string> = {
  high: "is-high",
  medium: "is-medium",
  low: "is-low",
  insufficient: "is-insufficient",
  unavailable: "is-unavailable",
};

const KIND_LABEL: Record<TurningPointKind, string> = {
  score: "CritiScore",
  career: "Career",
  controversy: "Controversy",
  sentiment: "Sentiment",
  change: "Other",
};

const KIND_FILTERS: { key: HistoricalEventFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "score", label: "CritiScore" },
  { key: "career", label: "Career" },
  { key: "controversy", label: "Controversy" },
  { key: "sentiment", label: "Sentiment" },
];

function SnapshotChart({ snapshots }: { snapshots: HistoricalSnapshot[] }) {
  if (snapshots.length < 2) return null;
  const scores = snapshots.map((s) => s.sentimentScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = Math.max(1, max - min);
  return (
    <svg viewBox="0 0 300 60" className="hi-spark" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        fill="none"
        strokeWidth="2"
        points={snapshots
          .map((s, i) => {
            const x = (i / (snapshots.length - 1)) * 300;
            const y = 56 - ((s.sentimentScore - min) / span) * 52;
            return `${x},${y}`;
          })
          .join(" ")}
      />
    </svg>
  );
}

/**
 * Historical Intelligence — a reconstructed composite view over time,
 * not a longer Timeline. Every figure comes from `lib/historical.ts`,
 * which itself only reuses already-real, already-dated data (sentiment
 * snapshots, the CritiScore reconstruction, the career timeline, Change
 * Detection). Where that reconstruction has no anchor, this shows an
 * explicit gap rather than a guess.
 */
export default function HistoricalIntelligence({
  overview,
  snapshots,
}: {
  overview: HistoricalOverview;
  snapshots: HistoricalSnapshot[];
}) {
  const defaultRange: HistoricalTimeRange = overview.supportedRanges.includes("1y")
    ? "1y"
    : overview.supportedRanges[overview.supportedRanges.length - 1] ?? "all";
  const [range, setRange] = useState<HistoricalTimeRange>(defaultRange);
  const [eventFilter, setEventFilter] = useState<HistoricalEventFilter>("all");
  const [compareRange, setCompareRange] = useState<HistoricalTimeRange | null>(null);

  if (!overview.hasHistory) {
    return (
      <p className="state-block">
        <span className="sb-title">No historical record yet</span>
        Historical Intelligence needs at least two dated observations — a
        second measured sentiment snapshot, or a second dated controversy
        year — before a shape can be shown. This is a data-coverage gap,
        not a finding of &ldquo;no history&rdquo;.
      </p>
    );
  }

  const visible = filterSnapshotsByRange(snapshots, range);
  const visiblePoints = filterTurningPoints(overview.turningPoints, eventFilter);
  const comparison = compareRange ? comparePeriods(snapshots, range, compareRange) : null;

  return (
    <div className="hi-root">
      <div className="hi-overview">
        <div className="dc-card-row">
          <span className="dc-card-label">Tracked since</span>
          <span>{overview.firstSnapshotDate ?? "—"}</span>
        </div>
        <div className="dc-card-row">
          <span className="dc-card-label">Latest observation</span>
          <span>{overview.latestSnapshotDate ?? "—"}</span>
        </div>
        <div className="dc-card-row">
          <span className="dc-card-label">Measured snapshots</span>
          <span>{overview.snapshotCount}</span>
        </div>
      </div>

      <div className="hi-coverage">
        <h4>Historical data coverage</h4>
        <ul className="dc-card-list">
          {overview.coverage.map((d) => (
            <li key={d.key} className="dc-card-row">
              <span className="dc-card-label">{d.label}</span>
              <span className={`dc-pill ${LEVEL_CLASS[d.level]}`}>{d.level.toUpperCase()}</span>
            </li>
          ))}
        </ul>
        <p className="dc-footnote">
          A provider outage today never reads as &ldquo;no history&rdquo; here
          — coverage is judged only by how much real dated history already
          exists.
        </p>
      </div>

      {overview.supportedRanges.length > 0 && (
        <div className="hi-ranges" role="group" aria-label="Time range">
          {overview.supportedRanges.map((r) => (
            <button
              key={r}
              type="button"
              className={`cv-filter ${r === range ? "is-active" : ""}`}
              onClick={() => setRange(r)}
            >
              {HISTORICAL_RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      )}

      <SnapshotChart snapshots={visible} />

      {overview.turningPoints.length > 0 && (
        <div className="hi-turning-points">
          <h4>Major turning points</h4>
          <div className="cv-filters" role="group" aria-label="Turning point type">
            {KIND_FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`cv-filter ${f.key === eventFilter ? "is-active" : ""}`}
                onClick={() => setEventFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <ul className="hi-tp-list">
            {visiblePoints.map((p) => (
              <li key={p.id} className="hi-tp-row">
                <span className="hi-tp-date">{p.date}</span>
                <span className="hi-tp-kind">{KIND_LABEL[p.kind]}</span>
                <span className="hi-tp-title">{p.title}</span>
                {p.relatedChangeId && (
                  <a href="#change-history" className="cv-evidence-link">
                    View change →
                  </a>
                )}
              </li>
            ))}
            {visiblePoints.length === 0 && <li className="hi-tp-empty">No turning points of this type.</li>}
          </ul>
        </div>
      )}

      {overview.supportedRanges.length > 1 && (
        <div className="hi-compare">
          <h4>Compare periods</h4>
          <div className="cv-filters" role="group" aria-label="Compare against">
            {overview.supportedRanges
              .filter((r) => r !== range)
              .map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`cv-filter ${r === compareRange ? "is-active" : ""}`}
                  onClick={() => setCompareRange((c) => (c === r ? null : r))}
                >
                  vs. {HISTORICAL_RANGE_LABEL[r]}
                </button>
              ))}
          </div>
          {comparison && (
            <div className="hi-compare-grid">
              <div>
                <span className="dc-card-label">{HISTORICAL_RANGE_LABEL[comparison.rangeA]}</span>
                <p>CritiScore: {comparison.startScoreA ?? "—"} → {comparison.endScoreA ?? "—"}</p>
                <p>Sentiment change: {comparison.sentimentDeltaA ?? "—"}</p>
                <p>Controversies to date: {comparison.controversyCountA}</p>
              </div>
              <div>
                <span className="dc-card-label">{HISTORICAL_RANGE_LABEL[comparison.rangeB]}</span>
                <p>CritiScore: {comparison.startScoreB ?? "—"} → {comparison.endScoreB ?? "—"}</p>
                <p>Sentiment change: {comparison.sentimentDeltaB ?? "—"}</p>
                <p>Controversies to date: {comparison.controversyCountB}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="dc-footnote">
        Historical Intelligence is a client-side reconstruction over
        already-real dated data (measured sentiment snapshots, the
        deterministic CritiScore reconstruction, the career timeline, and
        Change Detection) — CritiTrack does not yet have a backend
        snapshot store, so this is disclosed as a reconstruction, never
        presented as a stored record. Methodology {HISTORICAL_METHODOLOGY_VERSION}.
      </p>
    </div>
  );
}
