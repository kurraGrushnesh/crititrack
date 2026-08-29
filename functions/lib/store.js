"use strict";

/**
 * Firestore persistence for assembled celebrity payloads.
 *
 * Written with the Admin SDK, which bypasses security rules — the client
 * therefore never needs write access to `celebrities/*`.
 *
 * The field names here must match what the Flutter models read in
 * `Celebrity.fromFirestore`, `MediaItem.fromFirestore` and
 * `SentimentSnapshot.fromFirestore`. Changing one side without the other
 * silently degrades to default values rather than erroring, so keep them
 * in step.
 */

const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const logger = require("./logger");

const CELEBRITIES = "celebrities";
const MEDIA_ITEMS = "media_items";
const SENTIMENT_SNAPSHOTS = "sentiment_snapshots";
const DEVICES = "devices";

/** Firestore rejects `undefined`; the SDK's ignoreUndefinedProperties is
 * not enabled here, so normalise to null explicitly.
 * @param {any} v @return {any} */
function orNull(v) {
  return v === undefined ? null : v;
}

/**
 * Today's measured snapshot.
 *
 * Replaces `toSnapshots`, which took the model's seven-entry `trendData`
 * — a series it invents, having never seen a single historical figure —
 * mapped it onto the trailing seven real dates, and wrote all seven into
 * this collection with `totalMentions: 0`.
 *
 * That was not merely a cosmetic problem with the chart. This collection
 * is what `readSnapshotHistory` feeds to spike detection, so alerts were
 * being raised against invented history; it is what the compare screen
 * correlates, so "who moved together" was correlating fabrications; and
 * every refresh overwrote the last seven days with a fresh invention, so
 * the record never converged on anything.
 *
 * One refresh now records one day. History accumulates at the rate it
 * actually accumulates, which is slow, and the app says so rather than
 * drawing a confident week-long line over three hours of data.
 *
 * @param {object} s the assembled sentiment
 * @param {Date} [now]
 * @return {object} a snapshot document keyed by its own date
 */
function todaySnapshot(s, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const total = Math.max(0, Math.round(numOr(s.sampleSize, 0)));

  return {
    date,
    label: date,
    // Counted from the per-item blend rather than derived from ratios, so
    // they are the actual number of items in each band.
    positiveCount: Math.max(0, Math.round(numOr(s.positiveCount, 0))),
    negativeCount: Math.max(0, Math.round(numOr(s.negativeCount, 0))),
    neutralCount: Math.max(0, Math.round(numOr(s.neutralCount, 0))),
    totalMentions: total,
    sampleSize: total,
    dominantEmotion: s.dominantEmotion || "neutral",
    score: numOr(s.overallScore, 50),
    confidence: numOr(s.confidence, 0),
    // Marks this as an observation rather than a generated series. Rows
    // written before this change do not carry it and are deliberately
    // excluded from history — see readSnapshotHistory.
    measured: true,
    timestamp: now.toISOString(),
  };
}

/**
 * Coerces a model-supplied score to a finite number.
 *
 * Deliberately stricter than `Number.isFinite(Number(v))`: `Number(null)`
 * and `Number("")` are both 0, so that test would silently turn a missing
 * score into a strongly negative one and skew the chart. Only an actual
 * number, or a string that parses as one, is accepted.
 *
 * @param {unknown} v @param {number} fallback @return {number}
 */
function numOr(v, fallback) {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/**
 * Persists an assembled payload to `celebrities/{slug}` plus its
 * `media_items` and `sentiment_snapshots` sub-collections.
 *
 * @param {object} payload result of assembleCelebrity()
 * @param {{trigger: string}} meta how this write was triggered
 * @return {Promise<void>}
 */
async function writeCelebrity(payload, meta = {trigger: "request"}) {
  const db = getFirestore();
  const docRef = db.collection(CELEBRITIES).doc(payload.slug);
  const s = payload.sentiment || {};

  const batch = db.batch();

  batch.set(
      docRef,
      {
        name: payload.name,
        biography: payload.biography,
        sentimentScore: orNull(s.overallScore),
        positiveRatio: orNull(s.positiveRatio),
        negativeRatio: orNull(s.negativeRatio),
        neutralRatio: orNull(s.neutralRatio),
        trendDirection: s.trendDirection || "stable",
        sentimentExplanation: s.explanation || "",
        dominantEmotion: s.dominantEmotion || "neutral",
        evidence: s.evidence || [],
        // The linear forecast is computed client-side from the snapshots;
        // persisted empty so the reader falls back to its own computation.
        forecast: [],
        scoreNews: orNull(s.scoreNews),
        scoreYoutube: orNull(s.scoreYoutube),
        scoreInstagram: orNull(s.scoreInstagram),
        fetchedAt: payload.fetchedAt,
        cacheVersion: 1,
        // ── Tracking metadata (server-only, ignored by the client) ──
        refreshedAt: FieldValue.serverTimestamp(),
        lastTrigger: meta.trigger,
      },
      {merge: true},
  );

  for (const item of payload.media || []) {
    if (!item.id) continue;
    batch.set(docRef.collection(MEDIA_ITEMS).doc(String(item.id)), {
      type: item.type,
      title: item.title || "",
      url: item.url || "",
      thumbnailUrl: orNull(item.thumbnailUrl),
      source: orNull(item.source),
      publishedAt: orNull(item.publishedAt),
      description: orNull(item.description),
      sentimentTag: orNull(item.sentimentTag),
      sentimentScore: orNull(item.sentimentScore),
      videoId: item.type === "youtube" ? String(item.id) : null,
      channelTitle: orNull(item.channelTitle),
      mediaUrl: orNull(item.mediaUrl),
      permalink: orNull(item.permalink),
    });
  }

  // Keyed by date and merged, so several refreshes in one day
  // update that day rather than piling up.
  const snap = todaySnapshot(s);
  batch.set(
      docRef.collection(SENTIMENT_SNAPSHOTS).doc(snap.date),
      snap,
      {merge: true},
  );

  await batch.commit();
  logger.info(`stored ${payload.slug} (${meta.trigger})`);
}

/**
 * Records that a user asked for this celebrity, marking the document as
 * worth keeping warm. Called on every request, including cache hits.
 *
 * @param {string} slug
 * @param {string} name
 * @return {Promise<void>}
 */
async function markRequested(slug, name) {
  const db = getFirestore();
  await db.collection(CELEBRITIES).doc(slug).set(
      {
        name,
        lastRequestedAt: FieldValue.serverTimestamp(),
        requestCount: FieldValue.increment(1),
      },
      {merge: true},
  );
}

/**
 * The celebrities the scheduler should keep fresh: those a user has
 * actually asked for recently, most-recently-requested first.
 *
 * Bounding by both recency and count keeps the timer's spend on Groq,
 * NewsAPI and YouTube predictable no matter how large the collection
 * grows.
 *
 * @param {{withinDays: number, limit: number}} opts
 * @return {Promise<Array<{slug: string, name: string}>>}
 */
async function listTracked(opts) {
  const db = getFirestore();
  const cutoff = new Date(Date.now() - opts.withinDays * 24 * 60 * 60 * 1000);

  const snap = await db
      .collection(CELEBRITIES)
      .where("lastRequestedAt", ">=", cutoff)
      .orderBy("lastRequestedAt", "desc")
      .limit(opts.limit)
      .get();

  return snap.docs.map((d) => ({
    slug: d.id,
    name: (d.data() || {}).name || d.id,
  }));
}


/**
 * The trailing daily scores already stored for a figure, oldest first.
 *
 * Read from the snapshots the scheduler writes, so the alert baseline is
 * real measured history rather than anything the model asserted.
 *
 * @param {string} slug
 * @param {number} [days]
 * @return {Promise<Array<{date: string, score: number}>>}
 */
async function readSnapshotHistory(slug, days = 14) {
  const db = getFirestore();
  const snap = await db
      .collection(CELEBRITIES)
      .doc(slug)
      .collection(SENTIMENT_SNAPSHOTS)
      .orderBy("date", "desc")
      .limit(days)
      .get();

  return snap.docs
      .map((d) => d.data())
      .filter((d) => d && typeof d.score === "number")
      // Only observations. Rows written before the change that
      // introduced this flag came from the model's invented
      // seven-day series; including them would mean spike
      // detection and the compare correlations kept running over
      // fabricated history indefinitely.
      .filter((d) => d.measured === true)
      .map((d) => ({
        date: d.date,
        score: d.score,
        positiveCount: numOr(d.positiveCount, 0),
        negativeCount: numOr(d.negativeCount, 0),
        neutralCount: numOr(d.neutralCount, 0),
        totalMentions: numOr(d.totalMentions, 0),
        dominantEmotion: d.dominantEmotion || "neutral",
      }))
      .reverse();
}

/**
 * When this figure last triggered an alert, for the cooldown.
 *
 * @param {string} slug
 * @return {Promise<Date|null>}
 */
async function readLastAlertedAt(slug) {
  const db = getFirestore();
  const doc = await db.collection(CELEBRITIES).doc(slug).get();
  const raw = doc.exists ? (doc.data() || {}).lastAlertedAt : null;
  if (!raw) return null;
  // Firestore Timestamp or an ISO string, depending on who wrote it.
  if (typeof raw.toDate === "function") return raw.toDate();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Records that an alert fired, so the cooldown can be honoured.
 *
 * @param {string} slug
 * @param {object} spike
 * @return {Promise<void>}
 */
async function markAlerted(slug, spike) {
  await getFirestore().collection(CELEBRITIES).doc(slug).set(
      {
        lastAlertedAt: FieldValue.serverTimestamp(),
        lastAlertZScore: spike.zScore,
        lastAlertChange: spike.change,
      },
      {merge: true},
  );
}

/**
 * Devices that have asked to hear about this figure.
 *
 * The document id is a per-install identifier rather than the FCM token
 * itself. Tokens rotate — on reinstall, on restore to a new phone, and
 * periodically for no visible reason — and keying on one would leave a
 * dead row behind on every rotation. Keying on the install means a
 * rotation is an update to a field the app already owns.
 *
 * @param {string} slug
 * @return {Promise<Array<object>>} device rows, each carrying its own id
 */
async function readDevicesForSlug(slug) {
  const snap = await getFirestore()
      .collection(DEVICES)
      .where("slugs", "array-contains", slug)
      .get();

  return snap.docs.map((d) => ({id: d.id, ...d.data()}));
}

/**
 * Removes device rows whose tokens FCM has told us are permanently dead.
 *
 * Deleting the whole row rather than blanking the token is deliberate: a
 * row with no token is a row that will be read on every future alert and
 * filtered out every time, which is a slow leak in both cost and latency.
 *
 * @param {string[]} ids
 * @return {Promise<number>} how many were removed
 */
async function deleteDevices(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (unique.length === 0) return 0;

  const db = getFirestore();

  // Firestore caps a batch at 500 writes.
  for (let i = 0; i < unique.length; i += 500) {
    const batch = db.batch();
    for (const id of unique.slice(i, i + 500)) {
      batch.delete(db.collection(DEVICES).doc(id));
    }
    await batch.commit();
  }

  logger.info(`pruned ${unique.length} dead device(s)`);
  return unique.length;
}

module.exports = {
  writeCelebrity,
  markRequested,
  listTracked,
  todaySnapshot,
  readSnapshotHistory,
  readLastAlertedAt,
  markAlerted,
  readDevicesForSlug,
  deleteDevices,
};
