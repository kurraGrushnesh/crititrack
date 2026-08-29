"use strict";

/**
 * Links a model-cited evidence fragment back to the article it came from.
 *
 * The sentiment prompt asks for "a <= 12 word excerpt that drove the
 * score" and tags it with a source *type* — "news", "youtube" — which
 * says nothing about which of forty retrieved items it came from. So the
 * panel could show a fragment and the feed could show the articles, and
 * nothing connected the two.
 *
 * This closes that. It is deliberately a matcher rather than a lookup,
 * because the model is not asked to return an id and could not be trusted
 * to return a real one if it were: an invented id would link a fragment
 * to an unrelated article with complete confidence, which is worse than
 * not linking it at all.
 *
 * Being wrong in the cautious direction costs a tappable link. Being
 * wrong the other way attributes a quote to an article that never
 * contained it, under a name we have shown next to it. So an ambiguous
 * match resolves to null and the fragment simply is not tappable.
 */

const {distinctiveTerms} = require("./corroborate");

/**
 * The share of a fragment's distinctive terms that must appear in a
 * headline before the two are treated as the same story.
 */
const MIN_TERM_SHARE = 0.6;

/**
 * A fragment with fewer distinctive terms than this cannot be matched
 * confidently — "he denied the claims" overlaps with almost anything.
 */
const MIN_TERMS = 2;

/**
 * Lowercases and strips everything that is not a letter, digit or space,
 * so smart quotes and trailing punctuation do not defeat a containment
 * check that would otherwise succeed.
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
 * Scores how well one fragment matches one title.
 *
 * @param {string} fragment
 * @param {string} title
 * @return {{score: number, exact: boolean}}
 */
function matchScore(fragment, title) {
  const f = normalise(fragment);
  const t = normalise(title);
  if (!f || !t) return {score: 0, exact: false};

  // The fragment is meant to be an excerpt, so containment is the case
  // this is built for and is treated as certain.
  if (t.includes(f) || f.includes(t)) return {score: 1, exact: true};

  const fragTerms = distinctiveTerms(f);
  if (fragTerms.size < MIN_TERMS) return {score: 0, exact: false};

  const titleTerms = distinctiveTerms(t);
  let shared = 0;
  for (const term of fragTerms) if (titleTerms.has(term)) shared++;

  return {score: shared / fragTerms.size, exact: false};
}

/**
 * Attaches a `mediaId` to each evidence fragment, or null when no single
 * article is clearly the source.
 *
 * @param {object[]} evidence `[{fragment, source}]`
 * @param {object[]} media retrieved items carrying `id` and `title`
 * @return {object[]} the same fragments, each with `mediaId`
 */
function linkEvidence(evidence, media) {
  const items = (Array.isArray(media) ? media : []).filter(
      (m) => m && typeof m.id === "string" && m.id && m.title,
  );

  return (Array.isArray(evidence) ? evidence : [])
      .filter((e) => e && e.fragment)
      .map((e) => ({...e, mediaId: bestMatch(e.fragment, items)}));
}

/**
 * The one item a fragment came from, or null.
 *
 * @param {string} fragment
 * @param {object[]} items
 * @return {string|null}
 */
function bestMatch(fragment, items) {
  let best = null;
  let bestScore = 0;
  let runnerUp = 0;

  for (const item of items) {
    const {score} = matchScore(fragment, item.title);

    if (score > bestScore) {
      runnerUp = bestScore;
      bestScore = score;
      best = item.id;
    } else if (score > runnerUp) {
      runnerUp = score;
    }
  }

  if (bestScore < MIN_TERM_SHARE) return null;

  // Any tie at the top is ambiguity, containment included. Two headlines
  // can share an opening clause and still be different stories —
  // "announces surprise European stadium tour" and "...album release"
  // both contain "announces surprise European", and picking the first
  // would put a quote under a headline that never carried it.
  //
  // The case this seems to give up, two outlets running one syndicated
  // headline, is already collapsed by `dedupe` before anything reaches
  // here, so in practice a tie really does mean two different stories.
  if (bestScore === runnerUp) return null;

  return best;
}

module.exports = {
  linkEvidence,
  matchScore,
  normalise,
  MIN_TERM_SHARE,
  MIN_TERMS,
};
