import type { TimelineEvent } from "@/lib/timeline";

/**
 * The merged, dated spine over a figure's record — controversies,
 * attention spikes and sentiment shifts on one axis, most recent first.
 * Data comes from {@link buildTimeline}; this only lays it out.
 *
 * Each row carries an `id` so a deep link (`#event-YYYY-MM-DD`) can land
 * on it. A year-only controversy is shown as the year, never a false
 * "1 Jan".
 */

const KIND_LABEL: Record<TimelineEvent["kind"], string> = {
  controversy: "Controversy",
  "attention-spike": "Attention",
  "sentiment-shift": "Sentiment",
};

function displayDate(e: TimelineEvent): string {
  if (e.approxDate) return e.date.slice(0, 4);
  return new Date(e.date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function FigureTimeline({
  events,
}: {
  events: TimelineEvent[];
}) {
  if (events.length === 0) {
    return (
      <p className="state-block">
        <span className="sb-title">Nothing dated yet</span>
        The timeline fills in as controversies are recorded, attention
        spikes, or the sentiment score moves sharply between measured days.
      </p>
    );
  }

  return (
    <ol className="timeline">
      {events.map((e, i) => (
        <li
          key={`${e.date}-${e.kind}-${i}`}
          id={e.kind === "sentiment-shift" ? `event-${e.date}` : undefined}
          className={`timeline-item k-${e.kind}`}
        >
          <div className="timeline-date">
            {displayDate(e)} · {KIND_LABEL[e.kind]}
          </div>
          <p className="timeline-title">
            {e.title}
            {e.severity != null && (
              <span className="timeline-sev">severity {e.severity}</span>
            )}
          </p>
          {e.detail && <p className="timeline-detail">{e.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
