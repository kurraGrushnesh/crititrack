"use strict";

/**
 * The request logic, independent of how it is hosted.
 *
 * Two entry points wrap this: `index.js` (Firebase Cloud Functions, if
 * the project is ever on a billed plan) and `server.js` (a plain Node
 * process on a generic host, which is how it is deployed now). Both are
 * thin — they read the API keys from wherever that platform keeps
 * secrets, wire up transport, and call in here.
 *
 * Keeping one implementation means the two hosts cannot drift.
 */

const logger = require("./logger");

const {assembleCelebrity, ApiError} = require("./assemble");
const {validateName, toSlug, ValidationError} = require("./validate");
const {validateCorrection, CorrectionError} = require("./correction");
const {resolvePerson, resolveByQid} = require("./entity");
const {
  writeCelebrity,
  readCelebrityCache,
  markRequested,
  listTracked,
  listTrending,
  readSnapshotHistory,
  readLastAlertedAt,
  markAlerted,
  readDevicesForSlug,
  deleteDevices,
  writeCorrection,
} = require("./store");
const {detectSpike, shouldAlert, buildAlertMessage} = require("./alerts");
const {
  selectRecipients,
  buildPushPayload,
  chunkTokens,
  deadTokensFrom,
} = require("./push");
const {
  requireUser,
  requireAppCheck,
  consumeUserQuota,
  consumeGlobalBudget,
  consumeCorrectionQuota,
  GuardError,
} = require("./guard");

/** Messaging is loaded lazily so a host with no FCM need not configure it. */
function messaging() {
  return require("firebase-admin/messaging").getMessaging();
}

// ── GET /getCelebrity ────────────────────────────────────────────────

/**
 * How stale a cached payload may be before the request path re-assembles
 * it. Six hours: reputation and coverage move over days, not minutes,
 * the scheduled refresher keeps popular figures fresher than this, and
 * `?fresh=1` forces a rebuild.
 */
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * Serves one assembled celebrity payload and caches it.
 *
 * Persisting to Firestore is a side effect and deliberately non-fatal: a
 * storage outage degrades caching, not the response.
 *
 * @param {{groq: string, news: string, youtube: string}} keys
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function handleGetCelebrity(keys, req, res) {
  // ── SEC-02: perimeter ──────────────────────────────────────────────
  // Identity and attestation fail closed; metering fails open so a
  // Firestore outage degrades accounting rather than the product. Every
  // layer is relaxed inside the emulator (guard.js checks that itself).
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

  // SEC-03: the query parameter is attacker-controlled and flows into an
  // LLM prompt. Validate and canonicalise before spending anything.
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
    // Resolve to a canonical person before spending anything, so every
    // spelling of one name shares a cache entry and the upstream calls
    // use the canonical label — "ntr" becomes "N. T. Rama Rao".
    //
    // An explicit Wikidata id pins the lookup to the person the reader
    // chose from the disambiguation list; validated as a qid rather than
    // trusted, because it arrives in a query string.
    const pinned = String(req.query.qid || "");
    const entity = /^Q\d+$/.test(pinned) ?
      await resolveByQid(pinned) :
      await resolvePerson(name);
    const canonicalName = entity ? entity.label : name;
    const canonicalSlug = entity ? toSlug(entity.label) : slug;

    // Serve a recent cached assembly rather than re-running the whole
    // Groq + News + YouTube pipeline (~15-20s). Skipped when the reader
    // pinned a specific Wikidata id or asked for a fresh copy.
    if (!/^Q\d+$/.test(pinned) && req.query.fresh !== "1") {
      const cached = await readCelebrityCache(canonicalSlug, CACHE_MAX_AGE_MS);
      if (cached) {
        cached.query = name;
        if (cached.sentiment) {
          cached.sentiment.trendData =
            await readSnapshotHistory(canonicalSlug);
        }
        markRequested(canonicalSlug, canonicalName).catch(() => {});
        res.set("X-CritiTrack-Cache", "hit");
        res.json(cached);
        return;
      }
    }

    const payload = await assembleCelebrity(
        keys,
        canonicalName,
        canonicalSlug,
    );
    payload.entity = entity;
    payload.verified = entity !== null;
    payload.query = name;

    // The model still returns a seven-day series. It is dropped here
    // rather than shipped — it is invented, and the trend chart is a
    // query over what was measured. Cleared before the write so that a
    // failed write or read charts nothing, which is true, rather than a
    // fabrication, which is not.
    if (payload.sentiment) payload.sentiment.trendData = [];

    try {
      await writeCelebrity(payload, {trigger: "request"});
      await markRequested(canonicalSlug, canonicalName);

      if (payload.sentiment) {
        payload.sentiment.trendData =
          await readSnapshotHistory(canonicalSlug);
      }
    } catch (e) {
      logger.warn(`Firestore write failed for ${canonicalSlug}: ${e.message}`);
    }

    res.set("Cache-Control", "private, max-age=1800");
    res.status(200).json(payload);
  } catch (e) {
    logger.error("getCelebrity failed", {message: e && e.message});
    const status = e instanceof ApiError ? e.status : 500;
    res.status(status).json({
      error: (e && e.code) || "internal",
      message: (e && e.message) || "Unexpected error",
    });
  }
}

// ── POST /report-correction ─────────────────────────────────────────

/**
 * Records a dispute about something on a profile.
 *
 * Unlike getCelebrity, this endpoint is *not* behind App Check or a
 * Firebase token: the correction form on the static marketing site loads
 * no Firebase SDK and has no way to obtain either. It costs nothing to
 * run (a single Firestore write), so the exposure is a spam queue rather
 * than a bill. Two controls stand in front of it:
 *
 *   1. `validateCorrection` -- the shared schema, length bounds, safe-URL
 *      check and injection-marker filter.
 *   2. `consumeCorrectionQuota` -- a low per-IP cap (see guard.js).
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function handleReportCorrection(req, res) {
  let ipHash;
  try {
    ipHash = await consumeCorrectionQuota(req);
  } catch (e) {
    if (e instanceof GuardError) {
      for (const [h, v] of Object.entries(e.headers)) res.set(h, v);
      res.status(e.status).json({error: e.code, message: e.message});
      return;
    }
    throw e;
  }

  let clean;
  try {
    clean = validateCorrection(req.body || {});
  } catch (e) {
    if (e instanceof CorrectionError) {
      res.status(e.status).json({
        error: e.code,
        field: e.field,
        message: e.message,
      });
      return;
    }
    throw e;
  }

  try {
    const id = await writeCorrection(clean, {ipHash});
    res.status(201).json({ok: true, id});
  } catch (e) {
    logger.error("report-correction write failed", {message: e && e.message});
    res.status(500).json({
      error: "internal",
      message: "Could not record the report. Please try again later.",
    });
  }
}

// ── GET /trending ────────────────────────────────────────────────────

/**
 * Serves the most-looked-up figures on this deployment.
 *
 * Not behind App Check or a Firebase token: it is a single bounded
 * Firestore query returning only public fields (name, portrait, current
 * score), the same data any profile page already shows. A short shared
 * cache absorbs repeated hits. An empty result is returned as an empty
 * list — the caller renders nothing rather than a hard-coded stand-in.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function handleTrending(req, res) {
  const raw = Number(req.query.limit);
  const limit = Number.isFinite(raw) ? Math.min(24, Math.max(1, raw)) : 12;

  try {
    const figures = await listTrending({limit});
    res.set("Cache-Control", "public, max-age=300");
    res.status(200).json({figures});
  } catch (e) {
    logger.error("trending failed", {message: e && e.message});
    res.status(500).json({error: "internal", message: "Could not load trending."});
  }
}

// ── Scheduled refresh ────────────────────────────────────────────────

/**
 * REFRESH_LIMIT bounds the per-run spend on Groq, NewsAPI and YouTube: at
 * most this many figures are re-fetched per tick, no matter how large the
 * collection grows.
 */
const REFRESH_LIMIT = 10;
const TRACK_WINDOW_DAYS = 7;

/**
 * Re-fetches the figures users looked at recently, so the data is warm
 * when someone opens the dashboard — and, more importantly, so each run
 * records one dated snapshot. That accumulating history is what turns an
 * invented trend line into a measured one.
 *
 * Runs sequentially: the upstream APIs rate-limit per key, and a timer
 * job has no latency budget to protect.
 *
 * @param {{groq: string, news: string, youtube: string}} keys
 * @return {Promise<{ok: number, failed: string[], alerted: number}>}
 */
async function runScheduledRefresh(keys) {
  const tracked = await listTracked({
    withinDays: TRACK_WINDOW_DAYS,
    limit: REFRESH_LIMIT,
  });

  if (tracked.length === 0) {
    logger.info("refresh: nothing tracked, skipping");
    return {ok: 0, failed: [], alerted: 0};
  }

  logger.info(`refresh: ${tracked.length} tracked`, {
    slugs: tracked.map((t) => t.slug),
  });

  let ok = 0;
  const failed = [];
  let alerted = 0;

  for (const {slug, name} of tracked) {
    try {
      // Read the baseline before writing today's snapshot, so today is
      // compared against history rather than against itself.
      const history = await readSnapshotHistory(slug);

      const payload = await assembleCelebrity(keys, name, slug);
      await writeCelebrity(payload, {trigger: "schedule"});
      ok++;

      if (await maybeAlert(slug, name, history, payload)) alerted++;
    } catch (e) {
      failed.push(slug);
      logger.warn(`refresh failed for ${slug}: ${e.message}`);
    }
  }

  logger.info(
      `refresh complete: ${ok} ok, ${failed.length} failed, ${alerted} alert(s)`,
      {failed},
  );
  return {ok, failed, alerted};
}

/**
 * Decides whether today's score is worth notifying about, and records it.
 *
 * @param {string} slug
 * @param {string} name
 * @param {Array<{date: string, score: number}>} history
 * @param {object} payload
 * @return {Promise<boolean>}
 */
async function maybeAlert(slug, name, history, payload) {
  const current =
    payload && payload.sentiment ? payload.sentiment.overallScore : null;
  if (typeof current !== "number") return false;

  const spike = detectSpike(history.map((h) => h.score), current);
  if (!spike.isSpike) return false;

  const lastAlertedAt = await readLastAlertedAt(slug);
  if (!shouldAlert(spike, lastAlertedAt)) {
    logger.info(`${slug}: spike suppressed by cooldown`, {spike});
    return false;
  }

  const message = buildAlertMessage(name, spike, current);
  logger.info(`ALERT ${slug}: ${message.title}`, {
    body: message.body,
    zScore: spike.zScore,
    change: spike.change,
    baseline: spike.mean,
    samples: history.length,
  });

  // Marked before sending, not after: if delivery throws, the cooldown
  // is still recorded, so a persistently failing FCM call does not
  // re-detect the same spike every tick and deliver a burst on recovery.
  await markAlerted(slug, spike);

  await deliverPush({slug, message, spike, score: current});
  return true;
}

/**
 * Sends the alert to every device that asked for it and is not inside its
 * quiet hours. Never throws — a push failure must not fail the refresh.
 *
 * @param {{slug: string, message: {title: string, body: string},
 *   spike: object, score: number}} args
 * @return {Promise<number>}
 */
async function deliverPush({slug, message, spike, score}) {
  let devices;
  try {
    devices = await readDevicesForSlug(slug);
  } catch (err) {
    logger.error(`${slug}: could not read devices for push`, {
      message: err && err.message,
    });
    return 0;
  }

  const tokens = selectRecipients(devices, slug, Date.now());
  if (tokens.length === 0) {
    logger.info(`${slug}: alert raised, no eligible devices`);
    return 0;
  }

  const payload = buildPushPayload({slug, message, spike, score});
  const idByToken = new Map(devices.map((d) => [d.token, d.id]));

  let accepted = 0;
  const dead = [];

  for (const batch of chunkTokens(tokens)) {
    try {
      const res = await messaging().sendEachForMulticast({
        ...payload,
        tokens: batch,
      });
      accepted += res.successCount;
      for (const token of deadTokensFrom(res, batch)) {
        const id = idByToken.get(token);
        if (id) dead.push(id);
      }
    } catch (err) {
      logger.error(`${slug}: FCM batch of ${batch.length} failed`, {
        message: err && err.message,
      });
    }
  }

  if (dead.length > 0) {
    try {
      await deleteDevices(dead);
    } catch (err) {
      logger.error(`${slug}: could not prune dead devices`, {
        message: err && err.message,
      });
    }
  }

  logger.info(
      `${slug}: push accepted ${accepted}/${tokens.length}` +
      (dead.length ? `, pruned ${dead.length}` : ""),
  );
  return accepted;
}

module.exports = {
  handleGetCelebrity,
  handleReportCorrection,
  handleTrending,
  runScheduledRefresh,
};
