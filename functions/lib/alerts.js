"use strict";

/**
 * Decides when a change in a figure's sentiment is worth interrupting
 * someone for.
 *
 * Spike detection already exists on the client, but it only runs while the
 * app is open — which is precisely when the user does not need telling.
 * This is the server-side half, run by the scheduler.
 *
 * The bar is deliberately high. A notification that fires spuriously is
 * worse than no notification at all: it trains people to ignore the next
 * one, and the next one might matter. Four independent conditions must all
 * hold before anything is sent.
 */

/** Z-score beyond which a day is unusual. Matches the client's default. */
const Z_THRESHOLD = 1.5;

/**
 * Minimum raw movement, in score points, regardless of z-score.
 *
 * A figure with very steady coverage has a tiny standard deviation, so a
 * three-point wobble can clear the z-score bar while meaning nothing.
 * Requiring both stops "statistically unusual" from being reported as
 * "significant".
 */
const MIN_ABSOLUTE_CHANGE = 8;

/** Days of history needed before any baseline is trustworthy. */
const MIN_HISTORY = 5;

/** How long to stay quiet about the same figure after alerting. */
const COOLDOWN_HOURS = 24;

/**
 * Measures how unusual `current` is against a trailing window.
 *
 * @param {number[]} history trailing scores, oldest first, excluding today
 * @param {number} current today's score
 * @param {number} [threshold]
 * @return {{
 *   isSpike: boolean, zScore: number, mean: number,
 *   stdDev: number, change: number, direction: string
 * }}
 */
function detectSpike(history, current, threshold = Z_THRESHOLD) {
  const scores = (Array.isArray(history) ? history : []).filter(
      (n) => typeof n === "number" && Number.isFinite(n),
  );

  const none = {
    isSpike: false,
    zScore: 0,
    mean: Number.isFinite(current) ? current : 0,
    stdDev: 0,
    change: 0,
    direction: "flat",
  };

  if (!Number.isFinite(current)) return none;
  if (scores.length < MIN_HISTORY) return none;

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((t, s) => t + (s - mean) ** 2, 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  const change = current - mean;

  // Perfectly flat history: any movement is infinitely unusual by z-score,
  // which is meaningless. Fall back to the absolute test alone.
  const zScore = stdDev === 0 ? 0 : change / stdDev;

  const unusual = stdDev === 0 ?
    Math.abs(change) >= MIN_ABSOLUTE_CHANGE :
    Math.abs(zScore) > threshold && Math.abs(change) >= MIN_ABSOLUTE_CHANGE;

  return {
    isSpike: unusual,
    zScore: round2(zScore),
    mean: round1(mean),
    stdDev: round2(stdDev),
    change: round1(change),
    direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

/**
 * Whether to actually send, given a detected spike and when we last did.
 *
 * A sustained event produces a spike every run for as long as it lasts.
 * Without a cooldown a single scandal would notify every thirty minutes
 * for days.
 *
 * @param {{isSpike: boolean}} spike
 * @param {Date|string|null} lastAlertedAt
 * @param {Date} [now]
 * @return {boolean}
 */
function shouldAlert(spike, lastAlertedAt, now = new Date()) {
  if (!spike || !spike.isSpike) return false;
  if (!lastAlertedAt) return true;

  const last = lastAlertedAt instanceof Date ?
    lastAlertedAt :
    new Date(lastAlertedAt);
  if (Number.isNaN(last.getTime())) return true;

  const hours = (now.getTime() - last.getTime()) / 36e5;
  return hours >= COOLDOWN_HOURS;
}

/**
 * The notification copy.
 *
 * States what moved and by how much, and never characterises why. "Why"
 * would be an unsourced claim about a named living person delivered
 * straight to a lock screen, where there is no room for the provenance
 * label the rest of the product carries.
 *
 * @param {string} name
 * @param {{direction: string, change: number}} spike
 * @param {number} current
 * @return {{title: string, body: string}}
 */
function buildAlertMessage(name, spike, current) {
  const points = Math.abs(Math.round(spike.change));
  const rose = spike.direction === "up";

  return {
    title: `${name}: sentiment ${rose ? "up" : "down"} sharply`,
    body:
      `${points} points ${rose ? "above" : "below"} the recent average, ` +
      `now ${Math.round(current)}/100. Open CritiTrack to see the coverage ` +
      "behind the change.",
  };
}

/** @param {number} v @return {number} */
function round1(v) {
  return Math.round(v * 10) / 10;
}
/** @param {number} v @return {number} */
function round2(v) {
  return Math.round(v * 100) / 100;
}

module.exports = {
  detectSpike,
  shouldAlert,
  buildAlertMessage,
  Z_THRESHOLD,
  MIN_ABSOLUTE_CHANGE,
  MIN_HISTORY,
  COOLDOWN_HOURS,
};
