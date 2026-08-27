"use strict";

/**
 * CritiTrack API — server-side proxy for all third-party keys.
 *
 * The Flutter app calls only this function; Groq / NewsAPI / YouTube
 * keys never leave the server. Keys are stored as Firebase secrets
 * (Google Secret Manager) and, for the local emulator, read from
 * functions/.env.local.
 */

const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {setGlobalOptions} = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");

const {
  fetchBiography,
  analyzeSentiment,
  analyzeSourceSentiment,
  defaultSentiment,
  ApiError,
} = require("./lib/groq");
const {fetchNews, fetchVideos} = require("./lib/media");

setGlobalOptions({maxInstances: 10, region: "us-central1"});

const GROQ_API_KEY = defineSecret("GROQ_API_KEY");
const NEWS_API_KEY = defineSecret("NEWS_API_KEY");
const YOUTUBE_API_KEY = defineSecret("YOUTUBE_API_KEY");

/** @param {string} s @return {string} */
function toSlug(s) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * GET /getCelebrity?name=Zendaya
 * Returns the assembled biography + sentiment + media payload.
 */
exports.getCelebrity = onRequest(
    {secrets: [GROQ_API_KEY, NEWS_API_KEY, YOUTUBE_API_KEY], timeoutSeconds: 120, cors: true},
    async (req, res) => {
      const name = String(req.query.name || "").trim();
      if (!name) {
        res.status(400).json({error: "missing_name", message: "?name= is required"});
        return;
      }

      const groqKey = GROQ_API_KEY.value();
      const newsKey = NEWS_API_KEY.value();
      const ytKey = YOUTUBE_API_KEY.value();

      try {
        // ── Parallel: biography + media ────────────────────────────────
        const [bioResult, news, videos] = await Promise.all([
          fetchBiography(groqKey, name).then(
              (v) => ({ok: true, value: v}),
              (e) => ({ok: false, error: e}),
          ),
          fetchNews(newsKey, name),
          fetchVideos(ytKey, name),
        ]);

        const media = [...news, ...videos];

        if (!bioResult.ok && media.length === 0) {
          const e = bioResult.error;
          const status = e instanceof ApiError ? e.status : 502;
          res.status(status).json({
            error: (e && e.code) || "biography_failed",
            message: (e && e.message) || "Biography generation failed",
          });
          return;
        }

        const biography = bioResult.ok ? bioResult.value : {
          profession: "Public Figure",
          summary: `${name} — biography generation is temporarily unavailable. ` +
            "Live media is shown below.",
          background: "",
          notableWorks: [],
          controversies: [],
        };

        // ── Sentiment over combined headlines ──────────────────────────
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
            await analyzeSentiment(groqKey, name, allHeadlines, sourceLabels) :
            defaultSentiment("No media coverage found for sentiment analysis.");
        } catch (e) {
          logger.warn(`sentiment failed: ${e.message}`);
          sentiment = defaultSentiment("Sentiment analysis is temporarily unavailable.");
        }

        // ── Per-source decomposition (best effort) ─────────────────────
        const [scoreNews, scoreYoutube] = await Promise.all([
          analyzeSourceSentiment(groqKey, name, newsHeadlines, "news"),
          analyzeSourceSentiment(groqKey, name, ytTitles, "YouTube"),
        ]);

        res.set("Cache-Control", "public, max-age=1800");
        res.status(200).json({
          name,
          slug: toSlug(name),
          fetchedAt: new Date().toISOString(),
          biography,
          sentiment: {
            ...sentiment,
            scoreNews,
            scoreYoutube,
            scoreInstagram: null,
          },
          media,
        });
      } catch (e) {
        logger.error("getCelebrity failed", e);
        const status = e instanceof ApiError ? e.status : 500;
        res.status(status).json({
          error: (e && e.code) || "internal",
          message: (e && e.message) || "Unexpected error",
        });
      }
    },
);
