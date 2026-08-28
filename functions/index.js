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
const {fetchWikiSummary} = require("./lib/wiki");
const {validateName, ValidationError} = require("./lib/validate");
const {
  requireUser,
  requireAppCheck,
  consumeUserQuota,
  consumeGlobalBudget,
  GuardError,
  IS_EMULATOR,
} = require("./lib/guard");
const {initializeApp} = require("firebase-admin/app");

initializeApp();

// SEC-02: only origins we publish may call the API from a browser. `true`
// would reflect any Origin header, which is what made the endpoint
// scriptable from anywhere.
const ALLOWED_ORIGINS = IS_EMULATOR ?
  [/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/] :
  [
    "https://crititrack-f7430.web.app",
    "https://crititrack-f7430.firebaseapp.com",
  ];

setGlobalOptions({maxInstances: 10, region: "us-central1"});

const GROQ_API_KEY = defineSecret("GROQ_API_KEY");
const NEWS_API_KEY = defineSecret("NEWS_API_KEY");
const YOUTUBE_API_KEY = defineSecret("YOUTUBE_API_KEY");

/**
 * GET /getCelebrity?name=Zendaya
 * Returns the assembled biography + sentiment + media payload.
 */
exports.getCelebrity = onRequest(
    {
      secrets: [GROQ_API_KEY, NEWS_API_KEY, YOUTUBE_API_KEY],
      timeoutSeconds: 120,
      cors: ALLOWED_ORIGINS,
    },
    async (req, res) => {
      // ── SEC-02: perimeter ─────────────────────────────────────────
      // Identity and attestation fail closed; metering fails open so a
      // Firestore outage degrades accounting rather than the product.
      // Every layer is relaxed inside the emulator.
      try {
        await requireAppCheck(req);
        const uid = await requireUser(req);
        await consumeUserQuota(uid);
        await consumeGlobalBudget();
      } catch (e) {
        if (e instanceof GuardError) {
          for (const [h, v] of Object.entries(e.headers)) res.set(h, v);
          res.status(e.status).json({error: e.code, message: e.message});
          return;
        }
        throw e;
      }

      // SEC-03: the query parameter is attacker-controlled and flows into
      // an LLM prompt. Validate and canonicalise before spending anything.
      let name;
      let slug;
      try {
        ({name, slug} = validateName(req.query.name));
      } catch (e) {
        if (e instanceof ValidationError) {
          res.status(e.status).json({error: e.code, message: e.message});
          return;
        }
        throw e;
      }

      const groqKey = GROQ_API_KEY.value();
      const newsKey = NEWS_API_KEY.value();
      const ytKey = YOUTUBE_API_KEY.value();

      try {
        // ── Parallel: biography + media + portrait ─────────────────────
        const [bioResult, news, videos, wiki] = await Promise.all([
          fetchBiography(groqKey, name).then(
              (v) => ({ok: true, value: v}),
              (e) => ({ok: false, error: e}),
          ),
          fetchNews(newsKey, name),
          fetchVideos(ytKey, name),
          fetchWikiSummary(name),
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

        res.set("Cache-Control", "private, max-age=1800");
        res.status(200).json({
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
