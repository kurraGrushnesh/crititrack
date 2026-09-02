"use strict";

/**
 * CritiTrack API — Firebase Cloud Functions entry point.
 *
 * The request logic lives in lib/handlers.js; this file only wires it to
 * Cloud Functions and reads the API keys from Secret Manager. server.js
 * is the parallel entry point for a plain Node host, which is where the
 * backend currently runs (Cloud Functions needs a billed plan).
 *
 * Two entry points share one assembler:
 *   getCelebrity              — on demand, serves the app and caches
 *   refreshTrackedCelebrities — on a timer, records dated history
 */

const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const {setGlobalOptions} = require("firebase-functions/v2");
const {initializeApp} = require("firebase-admin/app");

const {
  handleGetCelebrity,
  handleReportCorrection,
  runScheduledRefresh,
} = require("./lib/handlers");

initializeApp();

// SEC-02: only origins we publish may call the API from a browser. `true`
// would reflect any Origin header, which is what made the endpoint
// scriptable from anywhere.
const ALLOWED_ORIGINS = [
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

exports.getCelebrity = onRequest(
    {secrets: ALL_SECRETS, timeoutSeconds: 120, cors: ALLOWED_ORIGINS},
    (req, res) => handleGetCelebrity(readKeys(), req, res),
);

exports.reportCorrection = onRequest(
    {timeoutSeconds: 30, cors: ALLOWED_ORIGINS},
    (req, res) => handleReportCorrection(req, res),
);

exports.refreshTrackedCelebrities = onSchedule(
    {
      schedule: "every 30 minutes",
      timeZone: "Etc/UTC",
      secrets: ALL_SECRETS,
      timeoutSeconds: 540,
      memory: "512MiB",
      retryCount: 0,
    },
    () => runScheduledRefresh(readKeys()),
);
