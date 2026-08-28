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
  analyzeSentiment,
  analyzeSourceSentiment,
  defaultSentiment,
  ApiError,
} = require("./groq");
const {fetchNews, fetchVideos} = require("./media");
const {fetchWikiSummary} = require("./wiki");

/**
 * @param {{groq: string, news: string, youtube: string}} keys
 * @param {string} name already validated by lib/validate.js
 * @param {string} slug canonical cache key for this name
 * @return {Promise<object>} the payload served to the app and stored
 */
async function assembleCelebrity(keys, name, slug) {
  // ── Parallel: biography + media + portrait ──────────────────────
  const [bioResult, news, videos, wiki] = await Promise.all([
    fetchBiography(keys.groq, name).then(
        (v) => ({ok: true, value: v}),
        (e) => ({ok: false, error: e}),
    ),
    fetchNews(keys.news, name),
    fetchVideos(keys.youtube, name),
    fetchWikiSummary(name),
  ]);

  const media = [...news, ...videos];

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
  const newsHeadlines = news.map((m) => m.title).filter(Boolean);
  const ytTitles = videos.map((m) => m.title).filter(Boolean);
  const allHeadlines = [...newsHeadlines, ...ytTitles];
  const sourceLabels = [
    ...newsHeadlines.map(() => "news"),
    ...ytTitles.map(() => "youtube"),
  ];

  let sentiment;
  try {
    sentiment = allHeadlines.length ?
      await analyzeSentiment(keys.groq, name, allHeadlines, sourceLabels) :
      defaultSentiment("No media coverage found for sentiment analysis.");
  } catch (e) {
    logger.warn(`sentiment failed for ${slug}: ${e.message}`);
    sentiment = defaultSentiment("Sentiment analysis is temporarily unavailable.");
  }

  // ── Per-source decomposition (best effort) ──────────────────────
  const [scoreNews, scoreYoutube] = await Promise.all([
    analyzeSourceSentiment(keys.groq, name, newsHeadlines, "news"),
    analyzeSourceSentiment(keys.groq, name, ytTitles, "YouTube"),
  ]);

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
