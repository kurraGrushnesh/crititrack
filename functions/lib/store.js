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
const logger = require("firebase-functions/logger");

const CELEBRITIES = "celebrities";
const MEDIA_ITEMS = "media_items";
const SENTIMENT_SNAPSHOTS = "sentiment_snapshots";

/** Firestore rejects `undefined`; the SDK's ignoreUndefinedProperties is
 * not enabled here, so normalise to null explicitly.
 * @param {any} v @return {any} */
function orNull(v) {
  return v === undefined ? null : v;
}

/**
 * Maps the LLM's 7-entry day trend onto the trailing 7 calendar dates,
 * oldest first, so the newest entry is today.
 *
 * The model returns weekday labels ("Mon", "Tue", …) which sort
 * alphabetically in Firestore and would render the chart out of order.
 * Real ISO dates as document ids fix the ordering and let successive
 * scheduled refreshes overwrite the same day rather than pile up.
 *
 * @param {Array<{day: string, score: number}>} trendData
 * @param {string} dominantEmotion
 * @return {Array<object>}
 */
function toSnapshots(trendData, dominantEmotion) {
  const entries = Array.isArray(trendData) ? trendData : [];
  const today = new Date();

  return entries.map((entry, i) => {
    const daysAgo = entries.length - 1 - i;
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    const date = d.toISOString().slice(0, 10);

    return {
      date,
      label: entry.day || date,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      totalMentions: 0,
      dominantEmotion: dominantEmotion || "neutral",
      score: numOr(entry.score, 50),
      timestamp: new Date().toISOString(),
    };
  });
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
      videoId: item.type === "youtube" ? String(item.id) : null,
      channelTitle: orNull(item.channelTitle),
      mediaUrl: orNull(item.mediaUrl),
      permalink: orNull(item.permalink),
    });
  }

  for (const snap of toSnapshots(s.trendData, s.dominantEmotion)) {
    batch.set(
        docRef.collection(SENTIMENT_SNAPSHOTS).doc(snap.date),
        snap,
        {merge: true},
    );
  }

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
      .map((d) => ({date: d.date, score: d.score}))
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

module.exports = {
  writeCelebrity,
  markRequested,
  listTracked,
  toSnapshots,
  readSnapshotHistory,
  readLastAlertedAt,
  markAlerted,
};
