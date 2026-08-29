"use strict";

/**
 * Builds the full celebrity payload from every upstream source.
 *
 * Deliberately shared by both entry points — the on-demand `getCelebrity`
 * request and the scheduled `refreshTrackedCelebrities` job. If each built
 * its own payload the two would drift, and a cached document would stop
 * matching a fresh one in ways nothing would catch.
 *
 * Every source is best-effort: a failure in one degrades that section
 * rather than the response. The one exception is a biography failure with
 * no media to fall back on, which has nothing left to show and throws.
 */

const logger = require("firebase-functions/logger");

const {
  fetchBiography,
  scoreItemsBatch,
  analyzeSentiment,
  analyzeSourceSentiment,
  defaultSentiment,
  ApiError,
} = require("./groq");
const lexicon = require("./sentiment/lexicon");
const {
  blendItem,
  aggregate,
  confidenceLabel,
  tagFor,
} = require("./sentiment/ensemble");
const {weightFor} = require("./sentiment/reach");
const {corroborate} = require("./corroborate");
const {fetchNews, fetchVideos, fetchGdelt, dedupe} = require("./media");
const {linkEvidence} = require("./evidence");
const {fetchWikiSummary} = require("./wiki");

/**
 * @param {{groq: string, news: string, youtube: string}} keys
 * @param {string} name already validated by lib/validate.js
 * @param {string} slug canonical cache key for this name
 * @return {Promise<object>} the payload served to the app and stored
 */
async function assembleCelebrity(keys, name, slug) {
  // ── Parallel: biography + media + portrait ──────────────────────
  const [bioResult, news, gdelt, videos, wiki] = await Promise.all([
    fetchBiography(keys.groq, name).then(
        (v) => ({ok: true, value: v}),
        (e) => ({ok: false, error: e}),
    ),
    fetchNews(keys.news, name),
    fetchGdelt(name),
    fetchVideos(keys.youtube, name),
    fetchWikiSummary(name),
  ]);

  // GDELT first: it is the broader, unmetered source, so when the two
  // overlap the deduper keeps its copy and NewsAPI's quota goes further.
  const articles = dedupe([...gdelt, ...news]);
  const media = dedupe([...articles, ...videos]);

  if (!bioResult.ok && media.length === 0) {
    const e = bioResult.error;
    throw e instanceof ApiError ? e : new ApiError(
        "biography_failed",
        (e && e.message) || "Biography generation failed",
        502,
    );
  }

  const biography = bioResult.ok ? bioResult.value : {
    profession: "Public Figure",
    summary: `${name} — biography generation is temporarily unavailable. ` +
      "Live media is shown below.",
    background: "",
    notableWorks: [],
    controversies: [],
  };

  // ── Sentiment over combined headlines ───────────────────────────
  const newsHeadlines = articles.map((m) => m.title).filter(Boolean);
  const ytTitles = videos.map((m) => m.title).filter(Boolean);

  // The ensemble scores the deduped `media` list, not articles+videos.
  // Deriving the text and the reach weight from the same array keeps them
  // aligned: building them from two different lists meant `media[i]` was
  // a different item than `allHeadlines[i]`, and undefined past the end.
  const scorable = media.filter((m) => m && m.title);
  const allHeadlines = scorable.map((m) => m.title);
  const sourceLabels = scorable.map((m) => m.type);

  let sentiment;
  try {
    sentiment = allHeadlines.length ?
      await analyzeSentiment(keys.groq, name, allHeadlines, sourceLabels) :
      defaultSentiment("No media coverage found for sentiment analysis.");
  } catch (e) {
    logger.warn(`sentiment failed for ${slug}: ${e.message}`);
    sentiment = defaultSentiment("Sentiment analysis is temporarily unavailable.");
  }

  // ── Ensemble (Phase 3) ──────────────────────────────────────────
  // Two independent methods score every headline: a lexicon that is free
  // and deterministic, and a batched LLM call that understands context.
  // How much they disagree becomes the confidence band — a single-method
  // score has nothing to disagree with, so it can only assert.
  if (allHeadlines.length > 0) {
    const [llmScores] = await Promise.all([
      scoreItemsBatch(keys.groq, allHeadlines),
    ]);
    const lexScores = lexicon.scoreAll(allHeadlines);

    const blended = allHeadlines
        .map((_, i) => {
          const b = blendItem({
            lexicon: lexScores[i],
            llm: llmScores[i] ? llmScores[i].score : null,
          });
          if (!b) return null;
          return {...b, weight: weightFor(scorable[i]), index: i};
        })
        .filter(Boolean);

    const agg = aggregate(blended);

    // Ratios are now counted from the per-item scores rather than asked
    // from the model, so they describe the coverage we actually retrieved.
    // ── Per-item tags (F05) ───────────────────────────────────
    // The blend already scores every item; until now that score was
    // aggregated and thrown away, so `sentimentTag` was a field the
    // prompt, the store and the client all handled and nothing ever
    // wrote. Every card in the feed carried a null.
    //
    // `scorable` holds the same object references as `media`, so
    // tagging here tags the items that actually get persisted.
    for (const b of blended) {
      const item = scorable[b.index];
      if (!item) continue;
      item.sentimentScore = Math.round(b.score);
      item.sentimentTag = tagFor(b.score);
    }

    const positive =
      blended.filter((b) => tagFor(b.score) === "positive").length;
    const negative =
      blended.filter((b) => tagFor(b.score) === "negative").length;
    const total = blended.length || 1;

    sentiment = {
      ...sentiment,
      overallScore: agg.score,
      confidence: agg.confidence,
      confidenceLabel: confidenceLabel(agg.confidence),
      scoreLow: agg.low,
      scoreHigh: agg.high,
      sampleSize: agg.sampleSize,
      methodAgreement: agg.meanSpread,
      positiveRatio: positive / total,
      negativeRatio: negative / total,
      neutralRatio: (total - positive - negative) / total,
    };
  }

  // ── Evidence → article (F05) ────────────────────────────────────
  // The model cites a fragment and a source *type* — "news",
  // "youtube" — which identifies no particular article, so a reader
  // could see a quote and see the coverage and have no way to get
  // from one to the other. Matching it back to a single item is what
  // makes the fragment tappable. An ambiguous match resolves to null
  // and the fragment stays inert, rather than pointing somewhere
  // plausible and wrong.
  sentiment = {
    ...sentiment,
    evidence: linkEvidence(sentiment.evidence, media),
  };

  // ── Per-source decomposition (best effort) ──────────────────────
  const [scoreNews, scoreYoutube] = await Promise.all([
    analyzeSourceSentiment(keys.groq, name, newsHeadlines, "news"),
    analyzeSourceSentiment(keys.groq, name, ytTitles, "YouTube"),
  ]);

  // ── Corroboration gate (SEC-04) ─────────────────────────────────
  // A serious allegation nothing we retrieved mentions is dropped rather
  // than rendered with the same authority as a documented one.
  const corpus = media.flatMap((m) => [m.title, m.description].filter(Boolean));
  const {kept, dropped} = corroborate(biography.controversies, corpus);
  if (dropped.length > 0) {
    logger.info(`${slug}: dropped ${dropped.length} uncorroborated claim(s)`);
  }
  biography.controversies = kept;

  return {
    name,
    slug,
    fetchedAt: new Date().toISOString(),
    image: wiki && wiki.imageUrl ?
      {url: wiki.imageUrl, source: "Wikipedia"} :
      null,
    biography,
    sentiment: {
      ...sentiment,
      scoreNews,
      scoreYoutube,
      scoreInstagram: null,
    },
    media,
  };
}

module.exports = {assembleCelebrity, ApiError};
