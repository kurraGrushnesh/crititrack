"use strict";

/**
 * Blends independent sentiment methods into one score with a confidence
 * band, and aggregates per-item scores by reach.
 *
 * The point of an ensemble is not that three numbers are better than one.
 * It is that three *independent* numbers can disagree, and how much they
 * disagree is itself information. A single-LLM app has nothing to compare
 * against, so it cannot report uncertainty at all; it can only assert.
 * Everything below exists to turn that disagreement into a number a
 * reader can weigh.
 */

/**
 * Relative trust in each method when all are present.
 *
 * The middle slot used to be called `transformer` and carried 0.4,
 * and nothing ever filled it — so the effective split was lexicon
 * 0.33 / llm 0.67 after renormalisation, and the ensemble described
 * three methods where it ran two. It is now a reputation lexicon
 * (lib/sentiment/domain.js) and named for what it is.
 *
 * The LLM keeps the largest share because it is the only method
 * that reads context. The two lexicons are cheap, deterministic and
 * independent of it, which is what makes their disagreement worth
 * measuring — that disagreement is the confidence band.
 */
const WEIGHTS = {lexicon: 0.2, domain: 0.25, llm: 0.55};

/**
 * Spread, in score points, at which the methods are considered to
 * disagree completely. Two methods 25 points apart on a 0-100 scale are
 * telling materially different stories.
 */
const MAX_DISAGREEMENT = 25;

/** Item count at which the sample-size term reaches one half. */
const SAMPLE_HALF_POINT = 10;

/**
 * Combines one item's scores from each method.
 *
 * @param {{lexicon?: number|null, domain?: number|null, llm?: number|null}} s
 * @return {{score: number, spread: number, methods: string[]}|null}
 */
function blendItem(s) {
  const present = Object.keys(WEIGHTS).filter(
      (k) => typeof s[k] === "number" && Number.isFinite(s[k]),
  );
  if (present.length === 0) return null;

  // Renormalise over whichever methods actually produced a number, so a
  // abstaining domain lexicon shifts weight to the others rather than
  // dragging the result toward zero.
  const totalWeight = present.reduce((t, k) => t + WEIGHTS[k], 0);
  const score = present.reduce(
      (t, k) => t + s[k] * (WEIGHTS[k] / totalWeight),
      0,
  );

  const values = present.map((k) => s[k]);
  const spread = values.length < 2 ? 0 : Math.max(...values) - Math.min(...values);

  return {score: clamp(score, 0, 100), spread, methods: present};
}

/**
 * Aggregates blended item scores into one figure-level result.
 *
 * Weighted by reach rather than counted equally: a front-page story and a
 * 200-view upload should not move the number by the same amount, and
 * saying so is defensible in a way that a flat average is not.
 *
 * @param {Array<{score: number, spread: number, weight?: number}>} items
 * @return {{
 *   score: number, confidence: number, low: number, high: number,
 *   sampleSize: number, meanSpread: number
 * }}
 */
function aggregate(items) {
  const usable = (items || []).filter(
      (i) => i && Number.isFinite(i.score),
  );

  if (usable.length === 0) {
    return {
      score: 50,
      confidence: 0,
      low: 0,
      high: 100,
      sampleSize: 0,
      meanSpread: 0,
    };
  }

  const totalWeight = usable.reduce((t, i) => t + weightOf(i), 0);
  const score = usable.reduce(
      (t, i) => t + i.score * (weightOf(i) / totalWeight),
      0,
  );

  const meanSpread =
    usable.reduce((t, i) => t + (Number.isFinite(i.spread) ? i.spread : 0), 0) /
    usable.length;

  const confidence = confidenceOf(usable, meanSpread);

  // A low-confidence score is not wrong, it is imprecise — so it is shown
  // as a band rather than a point. The band never leaves 0-100.
  const margin = (1 - confidence) * 20;

  return {
    score: round1(clamp(score, 0, 100)),
    confidence: round2(confidence),
    low: round1(clamp(score - margin, 0, 100)),
    high: round1(clamp(score + margin, 0, 100)),
    sampleSize: usable.length,
    meanSpread: round1(meanSpread),
  };
}

/**
 * Confidence in [0, 1], from three independent signals:
 *
 *   agreement — how closely the methods landed on each item
 *   sample    — how much evidence there was
 *   coverage  — how many methods were actually available
 *
 * @param {Array<object>} items
 * @param {number} meanSpread
 * @return {number}
 */
function confidenceOf(items, meanSpread) {
  const agreement = 1 - Math.min(1, meanSpread / MAX_DISAGREEMENT);

  const n = items.length;
  const sample = n / (n + SAMPLE_HALF_POINT);

  const meanMethods =
    items.reduce(
        (t, i) => t + (Array.isArray(i.methods) ? i.methods.length : 1),
        0,
    ) / n;
  const coverage = Math.min(1, meanMethods / 3);

  return clamp(0.5 * agreement + 0.3 * sample + 0.2 * coverage, 0, 1);
}

/** @param {object} i @return {number} */
function weightOf(i) {
  const w = i.weight;
  return Number.isFinite(w) && w > 0 ? w : 1;
}

/** @param {number} v @param {number} lo @param {number} hi @return {number} */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** @param {number} v @return {number} */
function round1(v) {
  return Math.round(v * 10) / 10;
}

/** @param {number} v @return {number} */
function round2(v) {
  return Math.round(v * 100) / 100;
}

/** Plain-language reading of a confidence value, for the UI. */
function confidenceLabel(c) {
  if (c >= 0.75) return "High confidence";
  if (c >= 0.5) return "Moderate confidence";
  if (c >= 0.3) return "Low confidence";
  return "Very low confidence";
}

/** Score at or above which an item counts as positive coverage. */
const POSITIVE_AT = 65;

/** Score below which an item counts as negative coverage. */
const NEGATIVE_BELOW = 40;

/**
 * The band a blended item score falls in.
 *
 * Centralised so the per-item tag shown on a card in the feed and the
 * positive/negative ratios shown in the sentiment panel are computed from
 * one definition. They were separate inline comparisons, which is the
 * kind of duplication that stays correct right up until one of them is
 * tuned.
 *
 * @param {number} score
 * @return {string|null} "positive" | "neutral" | "negative"
 */
function tagFor(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  if (score >= POSITIVE_AT) return "positive";
  if (score < NEGATIVE_BELOW) return "negative";
  return "neutral";
}

module.exports = {
  blendItem,
  tagFor,
  POSITIVE_AT,
  NEGATIVE_BELOW,
  aggregate,
  confidenceOf,
  confidenceLabel,
  WEIGHTS,
  MAX_DISAGREEMENT,
};
