"use strict";

/**
 * The third scoring method: a reputation lexicon.
 *
 * The ensemble had a slot named `transformer`, weighted 0.4, that nothing
 * ever filled. The weights renormalised over the two methods that did
 * produce a number, so it did no harm — but it named a component that did
 * not exist, and the ensemble's own documentation claimed three
 * independent methods where there were two.
 *
 * This fills it, and is named for what it is. It is not a transformer:
 * running one would mean bundling a model into a Cloud Function or paying
 * for a second inference call, and neither is worth it here.
 *
 * Why it is genuinely independent of VADER
 * ----------------------------------------
 * VADER measures general emotional valence. This measures *reputational
 * direction*, which is a different question, and the two come apart in
 * exactly the cases that matter most for this product:
 *
 *   "Cleared of all charges after two-year investigation"
 *
 * VADER sees "charges" and "investigation" and reads it as negative. It
 * is the best news the subject has had in two years. A lexicon that knows
 * "cleared" is a resolution scores it positively, and the disagreement
 * between the two is precisely the signal the confidence band is built
 * from.
 *
 * Why it abstains
 * ---------------
 * `score` returns null when a headline contains no reputational
 * vocabulary at all — most headlines about most people. Abstaining lets
 * `blendItem` renormalise over the methods that did have something to
 * say. Returning 50 instead would be an assertion of neutrality this
 * method has no basis for, and it would drag every score toward the
 * middle in proportion to how ordinary the coverage was.
 */

/**
 * Reputational weight in [-1, 1], where negative is damage and positive
 * is credit or vindication.
 *
 * Phrases are matched before single words, so "charges dropped" is not
 * read as "charged with". Negation is handled by listing the negated form
 * as its own phrase rather than by a separate negation pass, which keeps
 * this inspectable: every score this produces can be traced to entries
 * you can read.
 */
const TERMS = [
  // ── Resolution and vindication ───────────────────────────────────
  ["exonerated", 0.95],
  ["found not guilty", 0.9],
  ["not guilty", 0.9],
  ["acquitted", 0.9],
  ["charges dropped", 0.85],
  ["dropped the charges", 0.85],
  ["case dismissed", 0.8],
  ["cleared of", 0.8],
  ["cleared", 0.7],
  ["vindicated", 0.85],
  ["wins appeal", 0.7],
  ["settled amicably", 0.3],

  // ── Credit ───────────────────────────────────────────────────────
  ["lifetime achievement", 0.8],
  ["honoured", 0.7],
  ["honored", 0.7],
  ["acclaimed", 0.7],
  ["record-breaking", 0.6],
  ["wins award", 0.65],
  ["award", 0.5],
  ["praised", 0.6],
  ["celebrated", 0.55],
  ["nominated", 0.45],
  ["donates", 0.5],
  ["donation", 0.45],
  ["raises funds", 0.5],
  ["charity", 0.35],

  // ── Allegation ───────────────────────────────────────────────────
  ["found guilty", -1],
  ["convicted", -0.95],
  ["sentenced", -0.9],
  ["pleads guilty", -0.9],
  ["indicted", -0.85],
  ["charged with", -0.8],
  ["arrested", -0.8],
  ["under investigation", -0.7],
  ["investigated", -0.6],
  ["accused of", -0.65],
  ["accused", -0.6],
  ["allegations", -0.6],
  ["alleged", -0.5],
  ["sued", -0.55],
  ["lawsuit", -0.5],
  ["denies", -0.3],

  // ── Conduct ──────────────────────────────────────────────────────
  ["sexual assault", -0.95],
  ["assault", -0.85],
  ["misconduct", -0.8],
  ["harassment", -0.85],
  ["fraud", -0.85],
  ["tax evasion", -0.85],
  ["plagiarism", -0.7],
  ["doping", -0.8],

  // ── Consequence ──────────────────────────────────────────────────
  ["dropped by", -0.75],
  ["banned", -0.75],
  ["fired", -0.7],
  ["boycott", -0.65],
  ["steps down", -0.6],
  ["resigns", -0.6],
  ["suspended", -0.65],
  ["backlash", -0.6],
  ["scandal", -0.8],
  ["controversy", -0.5],
  ["criticised", -0.5],
  ["criticized", -0.5],
  ["slammed", -0.5],
  ["apologises", -0.4],
  ["apologizes", -0.4],
  ["apology", -0.35],
  ["settlement", -0.25],
];

/**
 * Longest first, so a phrase always wins over a word inside it.
 */
const ORDERED = [...TERMS].sort((a, b) => b[0].length - a[0].length);

/**
 * The most a lexicon of keywords is allowed to move the score from
 * neutral.
 *
 * Capped below the full range on purpose: matching two words is not
 * grounds for claiming 0 or 100, and letting it do so would let this
 * method dominate the blend on a single emotive term.
 */
const MAX_SHIFT = 45;

/**
 * Lowercases and collapses everything that is not a letter or digit, so
 * punctuation and casing cannot hide a term.
 *
 * @param {string} text
 * @return {string}
 */
function normalise(text) {
  return String(text || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
}

/**
 * Scores one headline's reputational direction.
 *
 * @param {string} text
 * @return {number|null} 0-100, or null when no term applies
 */
function score(text) {
  const haystack = normalise(text);
  if (!haystack) return null;

  // Consumed spans, so an overlapping shorter term cannot be counted a
  // second time inside a phrase that already matched.
  let remaining = haystack;
  const weights = [];

  for (const [term, weight] of ORDERED) {
    const needle = normalise(term);
    if (!needle) continue;

    let index = remaining.indexOf(needle);
    while (index !== -1) {
      weights.push(weight);
      remaining =
        remaining.slice(0, index) + " " + remaining.slice(index + needle.length);
      index = remaining.indexOf(needle);
    }
  }

  if (weights.length === 0) return null;

  // The mean, not the sum: three mild negatives are not worse than one
  // conviction, and summing would make a headline's score depend mostly
  // on how many words it happened to use.
  const mean = weights.reduce((t, w) => t + w, 0) / weights.length;

  return clamp(50 + MAX_SHIFT * mean, 0, 100);
}

/**
 * @param {string[]} texts
 * @return {Array<number|null>} aligned with `texts`
 */
function scoreAll(texts) {
  return (Array.isArray(texts) ? texts : []).map(score);
}

/**
 * @param {number} v @param {number} lo @param {number} hi @return {number}
 */
function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

module.exports = {score, scoreAll, normalise, TERMS, MAX_SHIFT};
