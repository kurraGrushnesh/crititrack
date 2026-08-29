"use strict";

/**
 * Corroboration gate for model-generated controversy claims (SEC-04).
 *
 * The citation gate in lib/groq.js requires that a serious claim *names* a
 * source. This goes further and asks whether anything we actually
 * retrieved supports it. The distinction matters: a model can invent a
 * plausible citation as easily as it can invent the claim.
 *
 * A severity 4 or 5 record is an allegation about a named living person.
 * Rendering one that no retrieved article mentions is the precise shape of
 * a defamation claim, so an uncorroborated one is dropped rather than
 * shown with the same authority as a documented one.
 *
 * The check is deliberately shallow — distinctive-term overlap, not
 * entailment. It is a floor, not a judgement: it cannot confirm a claim is
 * true, only that the surrounding coverage is talking about the same
 * thing. Being wrong in the cautious direction costs us a record; being
 * wrong the other way costs someone their reputation.
 */

const logger = require("./logger");

/** Severity at or above which corroboration is required. */
const CORROBORATION_REQUIRED_AT = 4;

/** Distinctive terms that must appear in the corpus for a claim to pass. */
const MIN_TERM_MATCHES = 2;

/** Words too common to be evidence of anything. */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "at", "for",
  "with", "by", "from", "as", "is", "was", "were", "be", "been", "being",
  "his", "her", "its", "their", "he", "she", "they", "it", "this", "that",
  "these", "those", "after", "before", "during", "over", "into", "about",
  "said", "says", "has", "have", "had", "not", "no", "who", "which", "when",
  "while", "also", "more", "most", "some", "such", "than", "then", "there",
  "controversy", "controversial", "criticism", "criticised", "criticized",
  "backlash", "row", "scandal", "issue", "incident", "response", "public",
]);

/**
 * Filters controversies down to those the retrieved coverage supports.
 *
 * @param {object[]} controversies already schema-validated by lib/groq.js
 * @param {string[]} corpus titles and descriptions we actually retrieved
 * @return {{kept: object[], dropped: object[]}}
 */
function corroborate(controversies, corpus) {
  const list = Array.isArray(controversies) ? controversies : [];
  const haystack = buildHaystack(corpus);

  const kept = [];
  const dropped = [];

  for (const c of list) {
    if (!c || typeof c !== "object") continue;

    const severity = Number(c.severity) || 1;

    if (severity < CORROBORATION_REQUIRED_AT) {
      // Minor episodes are historical context, not live allegations, and
      // are rarely in this week's headlines. Requiring corroboration would
      // strip a figure's history for no safety gain.
      kept.push(c);
      continue;
    }

    const matches = overlap(c, haystack);
    if (matches >= MIN_TERM_MATCHES) {
      kept.push({...c, corroborated: true, corroboratingTerms: matches});
    } else {
      dropped.push(c);
      logger.warn(
          `dropped uncorroborated severity-${severity} claim ` +
        `(${matches} term match${matches === 1 ? "" : "es"}): "${c.title}"`,
      );
    }
  }

  return {kept, dropped};
}

/**
 * How many distinctive terms from a claim appear in the corpus.
 *
 * @param {object} controversy
 * @param {Set<string>} haystack
 * @return {number}
 */
function overlap(controversy, haystack) {
  const terms = distinctiveTerms(
      `${controversy.title || ""} ${controversy.summary || ""}`,
  );
  let hits = 0;
  for (const t of terms) if (haystack.has(t)) hits++;
  return hits;
}

/**
 * Content words worth matching on: long enough to be specific, not a
 * stopword, and not the generic vocabulary of controversy itself — every
 * claim contains "criticism", so matching on it proves nothing.
 *
 * @param {string} text
 * @return {Set<string>}
 */
function distinctiveTerms(text) {
  return new Set(
      normalise(text)
          .split(" ")
          .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );
}

/**
 * @param {string[]} corpus
 * @return {Set<string>}
 */
function buildHaystack(corpus) {
  const words = new Set();
  for (const text of Array.isArray(corpus) ? corpus : []) {
    if (typeof text !== "string") continue;
    for (const w of normalise(text).split(" ")) {
      if (w.length >= 4) words.add(w);
    }
  }
  return words;
}

/** @param {string} s @return {string} */
function normalise(s) {
  return String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .replace(/[^a-z0-9]+/gu, " ")
      .trim();
}

module.exports = {
  corroborate,
  distinctiveTerms,
  buildHaystack,
  CORROBORATION_REQUIRED_AT,
  MIN_TERM_MATCHES,
};
