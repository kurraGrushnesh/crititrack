"use client";

import { useMemo, useState } from "react";
import { withinRangeDays, type TimelineEvent, type TimelineKind } from "@/lib/timeline";

/**
 * The Intelligence Timeline — controversies, career/organisation changes,
 * grouped news coverage, attention spikes and sentiment shifts on one
 * axis, most recent first. Data comes from {@link buildTimeline}; this
 * only lays it out, filters it, and lets a reader expand one event for
 * its sources and importance.
 *
 * Each row carries an `id` so a deep link (`#event-YYYY-MM-DD`) can land
 * on it. A year-only controversy or career step is shown as the year,
 * never a false day-precision date.
 */

const KIND_LABEL: Record<TimelineKind, string> = {
  controversy: "Controversy",
  career: "Career",
  organization: "Organization",
  news: "News",
  "attention-spike": "Attention",
  "sentiment-shift": "Sentiment",
  change: "Change",
};

const FILTERS: { key: "all" | TimelineKind; label: string }[] = [
  { key: "all", label: "All" },
  { key: "controversy", label: "Controversies" },
  { key: "career", label: "Career" },
  { key: "organization", label: "Organizations" },
  { key: "news", label: "News" },
  { key: "attention-spike", label: "Attention" },
  { key: "sentiment-shift", label: "Sentiment" },
  { key: "change", label: "Changes" },
];

const RANGES: { key: "30" | "90" | "365" | "all"; label: string; days: number | null }[] = [
  { key: "30", label: "30 Days", days: 30 },
  { key: "90", label: "90 Days", days: 90 },
  { key: "365", label: "1 Year", days: 365 },
  { key: "all", label: "All Time", days: null },
];

function displayDate(e: TimelineEvent): string {
  if (e.approxDate) return e.date.slice(0, 4);
  return new Date(e.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const IMPORTANCE_LABEL: Record<TimelineEvent["importance"], string> = {
  high: "High importance",
  medium: "Notable",
  low: "Minor",
};

export default function FigureTimeline({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = useState<"all" | TimelineKind>("all");
  const [range, setRange] = useState<"30" | "90" | "365" | "all">("all");

  const kindsPresent = useMemo(
    () => new Set(events.map((e) => e.kind)),
    [events],
  );
  const availableFilters = FILTERS.filter(
    (f) => f.key === "all" || kindsPresent.has(f.key),
  );

  const filtered = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)?.days ?? null;
    return events.filter((e) => {
      if (filter !== "all" && e.kind !== filter) return false;
      return withinRangeDays(e.date, days);
    });
  }, [events, filter, range]);

  if (events.length === 0) {
    return (
      <p className="state-block">
        <span className="sb-title">Nothing dated yet</span>
        The timeline fills in as controversies are recorded, the career
        record gains a step, coverage clusters on a day, attention spikes,
        or the sentiment score moves sharply between measured days.
      </p>
    );
  }

  return (
    <div className="tl-wrap">
      <div className="tl-controls">
        <div className="filter-bar" role="group" aria-label="Event type">
          {availableFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="filter-bar" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="state-block">
          <span className="sb-title">No events in this view</span>
          Nothing matches that filter and time range. Try All Time or a
          different event type.
        </p>
      ) : (
        <ol className="timeline">
          {filtered.map((e, i) => (
            <TimelineRow key={`${e.date}-${e.kind}-${i}`} event={e} />
          ))}
        </ol>
      )}
    </div>
  );
}

function TimelineRow({ event: e }: { event: TimelineEvent }) {
  const hasExpandable =
    e.sources.length > 0 || e.relatedTitles.length > 0 || e.importanceReason;

  return (
    <li
      id={e.kind === "sentiment-shift" ? `event-${e.date}` : undefined}
      className={`timeline-item k-${e.kind}`}
    >
      <div className="timeline-date">
        {displayDate(e)} · <span className="timeline-kind">{KIND_LABEL[e.kind]}</span>
      </div>
      <p className="timeline-title">
        {e.title}
        {e.severity != null && <span className="timeline-sev">severity {e.severity}</span>}
        {e.sourceCount != null && e.kind === "news" && (
          <span className="timeline-sev">{e.sourceCount} sources</span>
        )}
      </p>
      {e.detail && <p className="timeline-detail">{e.detail}</p>}

      {hasExpandable && (
        <details className="tl-expand">
          <summary>
            <span className={`tl-importance is-${e.importance}`}>
              {IMPORTANCE_LABEL[e.importance]}
            </span>
            <span className="tl-expand-label">Details</span>
          </summary>
          <div className="tl-expand-body">
            <p className="tl-reason">Why: {e.importanceReason}</p>
            {e.sentimentImpact != null && (
              <p className="tl-reason">Average tone: {e.sentimentImpact}/100</p>
            )}
            {e.attentionImpact != null && (
              <p className="tl-reason">
                Views that day: {e.attentionImpact.toLocaleString()}
              </p>
            )}
            {e.sources.length > 0 && (
              <ul className="tl-sources">
                {e.sources.map((s, i) => (
                  <li key={i}>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                        {s.label}
                      </a>
                    ) : (
                      <span>{s.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {e.relatedTitles.length > 0 && (
              <p className="tl-related">
                Also around this time: {e.relatedTitles.join(" · ")}
              </p>
            )}
          </div>
        </details>
      )}
    </li>
  );
}
