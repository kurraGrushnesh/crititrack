"use strict";

/**
 * Builds a weekly digest: for each figure a reader follows, how far its
 * sentiment moved over the trailing week and which way, ranked so the
 * biggest movers lead.
 *
 * This is the counterpart to alerts.js. An alert fires on a single sharp
 * spike; a digest is the routine "here is the week" summary, and its bar
 * is much lower — a reader who opted into a weekly note wants the whole
 * picture, including the figures that did not move.
 *
 * Pure and side-effect free. The scheduler reads the snapshot histories
 * and the device rows; this file only decides what the digest says.
 */

/** A week's worth of trailing snapshots is the comparison window. */
const WINDOW_DAYS = 7;

/** Below this many measured days, a per-figure change is withheld. */
const MIN_DAYS = 3;

/** Movement, in score points, under which a figure is called "steady". */
const STEADY_BAND = 4;

/** @param {number} v @return {number} */
function round1(v) {
  return Math.round(v * 10) / 10;
}

/**
 * One figure's line in the digest.
 *
 * `history` is the measured daily series, oldest first, as
 * `readSnapshotHistory` returns it. The change is the latest score minus
 * the score from roughly a week earlier — not a regression slope, because
 * a digest line is a plain "where it started, where it ended".
 *
 * @param {{slug: string, name: string}} figure
 * @param {Array<{date: string, score: number}>} history
 * @return {{
 *   slug: string, name: string, measuredDays: number,
 *   from: number|null, to: number|null, change: number|null,
 *   direction: "up"|"down"|"steady"|"unknown"
 * }}
 */
function figureLine(figure, history) {
  const series = (Array.isArray(history) ? history : []).filter(
      (h) => h && typeof h.score === "number" && Number.isFinite(h.score),
  );

  const base = {
    slug: figure.slug,
    name: figure.name || figure.slug,
    measuredDays: series.length,
  };

  if (series.length < MIN_DAYS) {
    return {...base, from: null, to: null, change: null, direction: "unknown"};
  }

  const recent = series.slice(-WINDOW_DAYS);
  const from = recent[0].score;
  const to = recent[recent.length - 1].score;
  const change = to - from;
  const direction =
    Math.abs(change) < STEADY_BAND ? "steady" : change > 0 ? "up" : "down";

  return {
    ...base,
    from: round1(from),
    to: round1(to),
    change: round1(change),
    direction,
  };
}

/**
 * Assembles the digest for one reader from the figures they follow.
 *
 * Lines with a known change are sorted by absolute movement, biggest
 * first; lines still gathering history sink to the bottom in name order.
 * `headline` is the single sentence a push notification would carry, or
 * null when nothing moved enough to be worth sending.
 *
 * @param {Array<{figure: {slug: string, name: string},
 *   history: Array<{date: string, score: number}>}>} entries
 * @return {{
 *   generatedAt: string,
 *   lines: ReturnType<typeof figureLine>[],
 *   movers: ReturnType<typeof figureLine>[],
 *   headline: string|null
 * }}
 */
function buildDigest(entries, now = new Date()) {
  const lines = (Array.isArray(entries) ? entries : [])
      .map((e) => figureLine(e.figure || {}, e.history || []))
      .sort((a, b) => {
        const am = a.change === null ? -Infinity : Math.abs(a.change);
        const bm = b.change === null ? -Infinity : Math.abs(b.change);
        if (am !== bm) return bm - am;
        return a.name.localeCompare(b.name);
      });

  const movers = lines.filter(
      (l) => l.direction === "up" || l.direction === "down",
  );

  return {
    generatedAt: now.toISOString(),
    lines,
    movers,
    headline: headlineFor(movers),
  };
}

/**
 * The one-sentence summary. Names the top mover and, if there is one, how
 * many others also shifted. States direction and magnitude only — never
 * why, for the same reason alerts.js does not.
 *
 * @param {ReturnType<typeof figureLine>[]} movers already sorted
 * @return {string|null}
 */
function headlineFor(movers) {
  if (movers.length === 0) return null;

  const top = movers[0];
  const points = Math.abs(Math.round(top.change));
  const dir = top.direction === "up" ? "up" : "down";
  const rest = movers.length - 1;

  const tail =
    rest === 0 ? "" : ` and ${rest} other${rest === 1 ? "" : "s"} moved too`;

  return (
    `${top.name} is ${dir} ${points} point${points === 1 ? "" : "s"} ` +
    `this week, now ${Math.round(top.to)}/100${tail}.`
  );
}

/**
 * The FCM message for a digest. Mirrors buildPushPayload in push.js: all
 * `data` values are strings, the notification collapses on a fixed tag so
 * a phone offline for a fortnight shows one digest rather than several,
 * and it deep-links to the app's watchlist rather than a single figure.
 *
 * @param {{headline: string, moverCount: number, topSlug: string}} args
 * @return {object} an FCM message minus its `tokens`
 */
function buildDigestPayload({headline, moverCount, topSlug}) {
  return {
    notification: {title: "Your CritiTrack week", body: headline},
    data: {
      kind: "digest",
      movers: String(moverCount),
      slug: String(topSlug || ""),
    },
    android: {
      priority: "normal",
      notification: {
        channelId: "crititrack_alerts",
        icon: "ic_stat_crititrack",
        tag: "weekly-digest",
      },
    },
    apns: {
      headers: {"apns-priority": "5"},
      payload: {aps: {sound: "default", threadId: "weekly-digest"}},
    },
  };
}

module.exports = {
  buildDigest,
  buildDigestPayload,
  figureLine,
  headlineFor,
  WINDOW_DAYS,
  MIN_DAYS,
  STEADY_BAND,
};
