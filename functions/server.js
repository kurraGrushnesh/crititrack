"use strict";

/**
 * CritiTrack API — plain Node entry point.
 *
 * Cloud Functions needs a billed Firebase plan, so the backend runs as an
 * ordinary Express service on a generic host instead. The request logic
 * is shared with the Cloud Functions entry point (index.js) via
 * lib/handlers.js, so the two cannot drift.
 *
 * Configuration, all from the environment:
 *
 *   PORT                       assigned by the host
 *   FIREBASE_SERVICE_ACCOUNT   the service-account JSON, as a single
 *                              string — this is what lets the Admin SDK
 *                              reach Firestore, Auth and App Check from
 *                              off-platform
 *   GROQ_API_KEY               \
 *   NEWS_API_KEY                }  upstream keys, never sent to the client
 *   YOUTUBE_API_KEY            /
 *   REFRESH_SECRET             shared secret the cron must present to
 *                              POST /refresh (the scheduled job has no
 *                              App Check token to offer)
 *   ALLOWED_ORIGIN_EXTRA       optional, comma-separated, added to the
 *                              CORS allow-list for local testing
 */

const express = require("express");
const cors = require("cors");
const {initializeApp, cert} = require("firebase-admin/app");

const logger = require("./lib/logger");
const {
  handleGetCelebrity,
  handleReportCorrection,
  handleTrending,
  runScheduledRefresh,
  runWeeklyDigest,
} = require("./lib/handlers");

// ── Admin SDK credentials ──────────────────────────────────────────────

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is not set. Paste the full " +
        "service-account JSON into that environment variable.",
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    // Some hosts mangle newlines in multi-line values; base64 sidesteps
    // that, so accept either form.
    try {
      return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON or base64 JSON.");
    }
  }
}

const serviceAccount = loadServiceAccount();
initializeApp({credential: cert(serviceAccount)});

// ── Keys ───────────────────────────────────────────────────────────────

function readKeys() {
  const keys = {
    groq: process.env.GROQ_API_KEY || "",
    news: process.env.NEWS_API_KEY || "",
    youtube: process.env.YOUTUBE_API_KEY || "",
  };
  const missing = Object.entries(keys)
      .filter(([, v]) => !v)
      .map(([k]) => k.toUpperCase() + "_API_KEY");
  if (missing.length) {
    logger.warn(`missing upstream keys: ${missing.join(", ")}`);
  }
  return keys;
}

// ── CORS ───────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  "https://crititrack-f7430.web.app",
  "https://crititrack-f7430.firebaseapp.com",
  ...(process.env.ALLOWED_ORIGIN_EXTRA || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
];

const corsMiddleware = cors({
  origin(origin, cb) {
    // No Origin header: a same-origin request, a health check, or the
    // cron. Allowed; the routes that matter have their own auth.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`origin not allowed: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Firebase-AppCheck",
    "X-Refresh-Secret",
  ],
  maxAge: 3600,
});

// ── App ────────────────────────────────────────────────────────────────

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(corsMiddleware);
app.options("*", corsMiddleware);

// A disallowed Origin makes the cors middleware call back with an Error,
// which Express would otherwise render as a 500. The request is not a
// server fault — it is a refusal — and logging it as one buries real
// faults among routine rejected traffic.
app.use((err, req, res, next) => {
  if (err && /^origin not allowed: /.test(err.message)) {
    logger.warn(err.message);
    return res.status(403).json({error: "origin_not_allowed"});
  }
  return next(err);
});

/**
 * GET /health — liveness, and optionally credential state.
 *
 * `cert()` does not verify anything: the Admin SDK only exercises the
 * credential on first real use. So a mangled FIREBASE_SERVICE_ACCOUNT
 * produces a service that boots, answers /health, and verifies ID and
 * App Check tokens (those use Google's public keys) while every
 * Firestore write fails — and writes are deliberately non-fatal, so the
 * API keeps returning good responses and nothing is ever cached. That
 * combination is invisible from outside, which is how it went unnoticed.
 *
 * `?deep=1` does a real Firestore round-trip and reports what happened.
 * It stays 200 either way: Render's health check hits the plain path,
 * and a 503 here would take the service down instead of reporting on it.
 */
app.get("/health", async (req, res) => {
  if (!req.query.deep) return res.json({ok: true});

  const keys = {
    groq: process.env.GROQ_API_KEY,
    news: process.env.NEWS_API_KEY,
    youtube: process.env.YOUTUBE_API_KEY,
  };

  const body = {
    ok: true,
    // Which project this process is actually writing to. A probe that
    // writes and deletes reports success even when it is pointed at the
    // wrong project's Firestore, so the identity has to be stated
    // outright. Project id and client email are not secrets; the key is.
    identity: {
      project: serviceAccount.project_id,
      serviceAccount: serviceAccount.client_email,
    },
    firestore: await firestoreProbe(),
    // Presence only. Whether a key is configured is operational state;
    // its value is a secret and never leaves the process.
    keys: {
      groq: Boolean(keys.groq),
      news: Boolean(keys.news),
      youtube: Boolean(keys.youtube),
    },
  };

  // ?upstream=1 additionally calls each provider, because a key that is
  // present can still be expired, revoked or out of quota — and that
  // failure looks identical from outside to a key that is missing.
  if (req.query.upstream) body.upstream = await upstreamProbe(keys);

  return res.json(body);
});

/**
 * Cheapest possible call against each provider, reporting the status
 * code only. No key or response body is echoed.
 *
 * @param {{groq: string, news: string, youtube: string}} keys
 * @return {Promise<object>}
 */
async function upstreamProbe(keys) {
  const check = async (name, url, init) => {
    if (!url) return {configured: false};
    try {
      const res = await fetch(url, {...init, signal: AbortSignal.timeout(10000)});
      return {configured: true, status: res.status, ok: res.ok};
    } catch (e) {
      return {configured: true, error: String(e.message).slice(0, 120)};
    }
  };

  const [groq, news, youtube] = await Promise.all([
    check("groq", keys.groq && "https://api.groq.com/openai/v1/models", {
      headers: {Authorization: `Bearer ${keys.groq}`},
    }),
    check(
        "news",
        keys.news &&
        `https://newsapi.org/v2/top-headlines?country=us&pageSize=1&apiKey=${keys.news}`,
        {},
    ),
    check(
        "youtube",
        keys.youtube &&
        "https://www.googleapis.com/youtube/v3/search?part=snippet&q=test" +
        `&maxResults=1&key=${keys.youtube}`,
        {},
    ),
  ]);

  return {groq, news, youtube};
}

/**
 * Writes and deletes one throwaway document, to prove the credential
 * actually works rather than merely parsing.
 *
 * @return {Promise<{ok: boolean, code?: string, message?: string}>}
 */
async function firestoreProbe() {
  try {
    const {getFirestore} = require("firebase-admin/firestore");
    const ref = getFirestore().collection("_diagnostics").doc("probe");
    await ref.set({at: new Date().toISOString()});
    await ref.delete();
    return {ok: true};
  } catch (e) {
    return {
      ok: false,
      code: e && e.code ? String(e.code) : undefined,
      // Enough to identify the failure, not enough to echo the key.
      message: String((e && e.message) || e).slice(0, 200),
    };
  }
}

app.get("/getCelebrity", (req, res) => {
  // handlers.js reads req.query.name / req.query.qid, exactly as under
  // Cloud Functions.
  handleGetCelebrity(readKeys(), req, res).catch((e) => {
    logger.error("unhandled in /getCelebrity", {message: e && e.message});
    if (!res.headersSent) {
      res.status(500).json({error: "internal", message: "Unexpected error"});
    }
  });
});

/**
 * POST /refresh — the scheduled job, triggered by an external cron.
 *
 * A cron cannot present an App Check token, so this route is gated on a
 * shared secret instead. Everything the cron can spend is already bounded
 * inside runScheduledRefresh (REFRESH_LIMIT figures per call), so the
 * secret only needs to stop idle traffic, not a determined attacker.
 */
/**
 * POST /report-correction — a dispute about something on a profile.
 *
 * JSON body, capped small: a correction is a few short fields, and a
 * larger body is either a mistake or an attempt to run us out of memory.
 */
app.post("/report-correction", express.json({limit: "16kb"}), (req, res) => {
  handleReportCorrection(req, res).catch((e) => {
    logger.error("unhandled in /report-correction", {message: e && e.message});
    if (!res.headersSent) {
      res.status(500).json({error: "internal", message: "Unexpected error"});
    }
  });
});

app.get("/trending", (req, res) => {
  handleTrending(req, res).catch((e) => {
    logger.error("unhandled in /trending", {message: e && e.message});
    if (!res.headersSent) {
      res.status(500).json({error: "internal", message: "Unexpected error"});
    }
  });
});

app.post("/refresh", async (req, res) => {
  const expected = process.env.REFRESH_SECRET;
  const given = req.get("X-Refresh-Secret") || req.query.secret;

  if (!expected) {
    return res.status(503).json({
      error: "not-configured",
      message: "REFRESH_SECRET is not set, so the refresh route is disabled.",
    });
  }
  if (given !== expected) {
    return res.status(403).json({error: "forbidden"});
  }

  try {
    const result = await runScheduledRefresh(readKeys());
    res.json(result);
  } catch (e) {
    logger.error("refresh failed", {message: e && e.message});
    res.status(500).json({error: "internal", message: e && e.message});
  }
});

/**
 * POST /digest — the weekly summary job, triggered by the same external
 * cron as /refresh and gated on the same shared secret. It spends nothing
 * upstream (Firestore reads plus FCM sends), so the secret only needs to
 * keep idle traffic out.
 */
app.post("/digest", async (req, res) => {
  const expected = process.env.REFRESH_SECRET;
  const given = req.get("X-Refresh-Secret") || req.query.secret;

  if (!expected) {
    return res.status(503).json({
      error: "not-configured",
      message: "REFRESH_SECRET is not set, so the digest route is disabled.",
    });
  }
  if (given !== expected) {
    return res.status(403).json({error: "forbidden"});
  }

  try {
    res.json(await runWeeklyDigest(readKeys()));
  } catch (e) {
    logger.error("digest failed", {message: e && e.message});
    res.status(500).json({error: "internal", message: e && e.message});
  }
});

const port = process.env.PORT || 8080;
const {APP_CHECK_ENFORCED} = require("./lib/guard");

app.listen(port, async () => {
  logger.info(`CritiTrack API listening on ${port}`, {
    origins: ALLOWED_ORIGINS,
    project: serviceAccount.project_id,
    appCheck: APP_CHECK_ENFORCED ? "enforced" : "DISABLED",
  });

  if (!APP_CHECK_ENFORCED) {
    logger.warn(
        "APP_CHECK_ENFORCED=false — calls are not attested. The endpoint " +
        "is still behind a Firebase token, the per-user rate limit and " +
        "the daily budget cap, but it can be scripted from outside the " +
        "app. Set a RECAPTCHA_SITE_KEY build and remove this flag to " +
        "restore attestation.",
    );
  }

  // Exercise the credential at boot rather than discovering on the first
  // request that it never worked. Logged, not fatal: the API still
  // serves useful responses without Firestore, it just cannot cache or
  // record history, and that is a state worth naming in the logs.
  const probe = await firestoreProbe();
  if (probe.ok) {
    logger.info("Firestore credential verified: writes are working.");
  } else {
    logger.error(
        "FIRESTORE WRITES ARE FAILING — responses will still be served, " +
        "but nothing will be cached and no history will be recorded. " +
        "Check that FIREBASE_SERVICE_ACCOUNT holds the complete " +
        "service-account JSON (or its base64 form).",
        probe,
    );
  }
});
