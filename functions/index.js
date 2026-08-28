"use strict";

/**
 * CritiTrack API.
 *
 * The Flutter app calls only these functions; Groq, NewsAPI and YouTube
 * keys never leave the server. Keys live in Secret Manager and, for the
 * local emulator, in functions/.secret.local.
 *
 * Two entry points share one assembler:
 *   getCelebrity              — on demand, serves the app and caches
 *   refreshTrackedCelebrities — on a timer, keeps recently-viewed figures
 *                               warm and records dated history
 */

const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const {setGlobalOptions} = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const {initializeApp} = require("firebase-admin/app");

const {assembleCelebrity, ApiError} = require("./lib/assemble");
const {validateName, toSlug, ValidationError} = require("./lib/validate");
const {resolvePerson} = require("./lib/entity");
const {writeCelebrity, markRequested, listTracked} = require("./lib/store");
const {
  requireUser,
  requireAppCheck,
  consumeUserQuota,
  consumeGlobalBudget,
  GuardError,
  IS_EMULATOR,
} = require("./lib/guard");

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

const ALL_SECRETS = [GROQ_API_KEY, NEWS_API_KEY, YOUTUBE_API_KEY];

/** @return {{groq: string, news: string, youtube: string}} */
function readKeys() {
  return {
    groq: GROQ_API_KEY.value(),
    news: NEWS_API_KEY.value(),
    youtube: YOUTUBE_API_KEY.value(),
  };
}

/**
 * GET /getCelebrity?name=Zendaya
 *
 * Persisting to Firestore is a side effect and deliberately non-fatal: a
 * storage outage degrades caching, not the response.
 */
exports.getCelebrity = onRequest(
    {
      secrets: ALL_SECRETS,
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

      try {
        // Phase 2: resolve to a canonical person before spending anything.
        // Every spelling of one name then shares a cache entry, and the
        // upstream calls are made with the canonical label rather than
        // whatever the user typed — "ntr" becomes "N. T. Rama Rao".
        const entity = await resolvePerson(name);
        const canonicalName = entity ? entity.label : name;
        const canonicalSlug = entity ? toSlug(entity.label) : slug;

        const payload = await assembleCelebrity(
            readKeys(),
            canonicalName,
            canonicalSlug,
        );
        payload.entity = entity;
        // A figure Wikidata does not list as a human is not one we can
        // corroborate, so the app is told rather than left to imply that
        // everything shown is equally well sourced.
        payload.verified = entity !== null;
        payload.query = name;

        try {
          await writeCelebrity(payload, {trigger: "request"});
          await markRequested(canonicalSlug, canonicalName);
        } catch (e) {
          logger.warn(`Firestore write failed for ${canonicalSlug}: ${e.message}`);
        }

        res.set("Cache-Control", "private, max-age=1800");
        res.status(200).json(payload);
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

// ── Scheduled refresh ────────────────────────────────────────────────
// REFRESH_LIMIT bounds the per-run spend on Groq, NewsAPI and YouTube: at
// most this many figures are re-fetched per tick, no matter how large the
// collection grows.
const REFRESH_LIMIT = 10;
const TRACK_WINDOW_DAYS = 7;

/**
 * Re-fetches the figures users looked at recently and updates their
 * Firestore documents, so the data is already warm when someone opens the
 * dashboard — and, more importantly, so each run records one dated
 * snapshot. That accumulating history is what turns an invented trend line
 * into a measured one.
 *
 * Runs sequentially rather than in parallel: the upstream APIs rate-limit
 * per key, and a timer job has no latency budget to protect.
 */
exports.refreshTrackedCelebrities = onSchedule(
    {
      schedule: "every 30 minutes",
      timeZone: "Etc/UTC",
      secrets: ALL_SECRETS,
      timeoutSeconds: 540,
      memory: "512MiB",
      retryCount: 0,
    },
    async () => {
      const tracked = await listTracked({
        withinDays: TRACK_WINDOW_DAYS,
        limit: REFRESH_LIMIT,
      });

      if (tracked.length === 0) {
        logger.info("refresh: nothing tracked, skipping");
        return;
      }

      logger.info(`refresh: ${tracked.length} tracked`, {
        slugs: tracked.map((t) => t.slug),
      });

      const keys = readKeys();
      let ok = 0;
      const failed = [];

      for (const {slug, name} of tracked) {
        try {
          const payload = await assembleCelebrity(keys, name, slug);
          await writeCelebrity(payload, {trigger: "schedule"});
          ok++;
        } catch (e) {
          // One bad figure must not abort the rest of the run.
          failed.push(slug);
          logger.warn(`refresh failed for ${slug}: ${e.message}`);
        }
      }

      logger.info(`refresh complete: ${ok} ok, ${failed.length} failed`, {
        failed,
      });
    },
);
