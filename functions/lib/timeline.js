"use strict";

/**
 * Merges everything CritiTrack knows about a figure that has a date onto
 * one chronological spine: recorded controversies, days when attention
 * spiked, and days when the sentiment score moved sharply.
 *
 * The point is to let a reader see cause and effect lined up — an
 * attention spike the same week as a controversy, a sentiment drop that
 * followed it — without cross-referencing three separate sections.
 *
 * Pure. Every event carries the source it came from, so nothing here is
 * an assertion the underlying section does not already make. An attention
 * spike is explicitly unsigned: it means people looked, not that the news
 * was bad.
 */

/** Standard deviations above the mean for an attention day to count. */
const ATTENTION_Z = 2;

/** Score points between consecutive snapshots for a "shift" event. */
const SHIFT_POINTS = 10;

/** @param {unknown} v @return {number|null} */
function finite(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Controversy episodes as events. A record with only a year is placed on
 * 1 January of that year and flagged `approxDate`, so the UI can render
 * it as "2019" rather than a false-precision "1 Jan 2019".
 *
 * @param {Array<object>} controversies
 * @return {Array<object>}
 */
function controversyEvents(controversies) {
  return (Array.isArray(controversies) ? controversies : [])
      .map((c) => {
        const year = finite(c && c.year);
        if (!year) return null;
        return {
          date: `${year}-01-01`,
          approxDate: true,
          kind: "controversy",
          title: (c && c.title) || "Controversy",
          detail: (c && c.summary) || (c && c.description) || "",
          severity: finite(c && c.severity),
          status: (c && c.status) || null,
        };
      })
      .filter(Boolean);
}

/**
 * Days on which Wikipedia attention was unusually high, by z-score over
 * the whole supplied series.
 *
 * @param {Array<{date: string, views: number}>} attentionSeries
 * @return {Array<object>}
 */
function attentionSpikeEvents(attentionSeries) {
  const points = (Array.isArray(attentionSeries) ? attentionSeries : [])
      .map((p) => ({date: p && p.date, views: finite(p && p.views)}))
      .filter((p) => p.date && p.views !== null);
  if (points.length < 5) return [];

  const views = points.map((p) => p.views);
  const mean = views.reduce((a, b) => a + b, 0) / views.length;
  const sd = Math.sqrt(
      views.reduce((t, v) => t + (v - mean) ** 2, 0) / views.length,
  );
  if (sd === 0) return [];

  return points
      .filter((p) => (p.views - mean) / sd >= ATTENTION_Z)
      .map((p) => ({
        date: p.date,
        kind: "attention-spike",
        title: "Attention spike",
        // Deliberately unsigned: a spike has no valence.
        detail:
          `Wikipedia views reached ${Math.round(p.views).toLocaleString()}, ` +
          `about ${(p.views / mean).toFixed(1)}x the period average.`,
        views: Math.round(p.views),
      }));
}

/**
 * Days on which the measured sentiment score jumped or dropped by more
 * than SHIFT_POINTS against the previous measured day.
 *
 * @param {Array<{date: string, score: number}>} history oldest first
 * @return {Array<object>}
 */
function sentimentShiftEvents(history) {
  const rows = (Array.isArray(history) ? history : [])
      .map((h) => ({date: h && h.date, score: finite(h && h.score)}))
      .filter((h) => h.date && h.score !== null);

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const delta = rows[i].score - rows[i - 1].score;
    if (Math.abs(delta) < SHIFT_POINTS) continue;
    const up = delta > 0;
    out.push({
      date: rows[i].date,
      kind: "sentiment-shift",
      title: `Sentiment ${up ? "rose" : "fell"} sharply`,
      detail:
        `${Math.abs(Math.round(delta))} points ${up ? "up" : "down"} ` +
        `in a day, to ${Math.round(rows[i].score)}/100.`,
      change: Math.round(delta),
    });
  }
  return out;
}

/**
 * The merged, most-recent-first timeline.
 *
 * @param {{
 *   controversies?: Array<object>,
 *   attentionSeries?: Array<object>,
 *   sentimentHistory?: Array<object>
 * }} input
 * @return {Array<object>}
 */
function buildTimeline(input = {}) {
  const events = [
    ...controversyEvents(input.controversies),
    ...attentionSpikeEvents(input.attentionSeries),
    ...sentimentShiftEvents(input.sentimentHistory),
  ];

  return events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    // Same day: controversy first, then attention, then sentiment.
    const order = {"controversy": 0, "attention-spike": 1, "sentiment-shift": 2};
    return (order[a.kind] ?? 9) - (order[b.kind] ?? 9);
  });
}

module.exports = {
  buildTimeline,
  controversyEvents,
  attentionSpikeEvents,
  sentimentShiftEvents,
  ATTENTION_Z,
  SHIFT_POINTS,
};
