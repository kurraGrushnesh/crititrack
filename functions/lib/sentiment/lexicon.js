"use strict";

/**
 * Lexicon scoring with VADER.
 *
 * The floor of the ensemble: microseconds, free, deterministic, and no
 * network. It is strong on short punchy headlines, which is most of what
 * we score, and weak on irony and context — which is precisely what the
 * other two methods are there to cover.
 *
 * Because it never fails and never costs anything, it is also the
 * fallback that keeps a score on screen when the paid methods are
 * unavailable.
 */

const vader = require("vader-sentiment");

/**
 * Scores one piece of text.
 *
 * VADER returns a `compound` in [-1, 1]; the app works in 0-100, where 50
 * is neutral, so the range is mapped rather than rescaled from 0.
 *
 * @param {string} text
 * @return {number|null} 0-100, or null when there is nothing to score
 */
function scoreText(text) {
  if (typeof text !== "string" || text.trim() === "") return null;
  const {compound} = vader.SentimentIntensityAnalyzer.polarity_scores(text);
  if (!Number.isFinite(compound)) return null;
  return (compound + 1) * 50;
}

/**
 * Scores a list, preserving positions so the result lines up with the
 * other methods' output.
 *
 * @param {string[]} texts
 * @return {Array<number|null>}
 */
function scoreAll(texts) {
  if (!Array.isArray(texts)) return [];
  return texts.map(scoreText);
}

module.exports = {scoreText, scoreAll};
