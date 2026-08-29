"use strict";

/**
 * Push delivery for spike alerts.
 *
 * `alerts.js` decides *whether* a movement is worth interrupting someone
 * for. This module decides *who* hears about it and builds the message
 * they receive. The two are kept apart because the first is a statistical
 * question and the second is a routing one, and they fail differently.
 *
 * Why device tokens rather than FCM topics
 * ----------------------------------------
 * A topic per figure would be less code: the client subscribes to
 * `figure-<slug>` and the server publishes once. It was rejected because
 * a topic subscriber is anonymous. The server cannot know whether it is
 * three in the morning where that subscriber is, so quiet hours could
 * only be enforced after the phone had already made a noise — which is
 * not a quiet-hours feature, it is an apology.
 *
 * Addressing devices individually costs a Firestore query per alert and
 * some token bookkeeping, and in exchange every preference in the
 * specification is actually enforceable before anything is sent.
 *
 * Everything here is pure. The Firestore read and the FCM call live in
 * the caller, so all of the routing logic is testable without a network.
 */

/** FCM rejects a multicast of more than 500 tokens. */
const MULTICAST_LIMIT = 500;

const MINUTES_PER_DAY = 1440;

/**
 * Error codes FCM returns for a token that will never work again.
 *
 * These mean the app was uninstalled, the token was rotated, or the token
 * is malformed — all permanent, so the device row should be deleted.
 * Transient failures (`messaging/server-unavailable`, quota errors) are
 * deliberately absent: deleting on those would unsubscribe people because
 * Google had a bad minute.
 */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

/**
 * The local wall-clock time on a device, in minutes since its midnight.
 *
 * @param {number} nowUtcMs
 * @param {number} utcOffsetMinutes east of UTC; +330 for IST, -480 for PST
 * @return {number} 0–1439
 */
function localMinutes(nowUtcMs, utcOffsetMinutes) {
  const raw = Math.floor(nowUtcMs / 60000) + utcOffsetMinutes;
  // Double modulo: JavaScript's % keeps the sign of the dividend, so a
  // device west of UTC shortly after midnight UTC would otherwise land on
  // a negative minute and never match any window.
  return ((raw % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/**
 * Whether a device is inside its do-not-disturb window right now.
 *
 * The window is stored as minutes since local midnight so that it is a
 * plain integer comparison here, with no date library and no ambiguity
 * about which day "22:00 to 07:00" refers to.
 *
 * A known limitation: `utcOffsetMinutes` is whatever the device reported
 * when it last registered, so it goes stale for an hour or so after a
 * daylight-saving transition or a flight. The client re-registers on
 * every app start, which bounds the error to the time between the change
 * and the next launch. Storing an IANA zone name instead would fix it
 * properly and needs a timezone database on the server; it is not worth
 * that for a feature whose failure mode is one notification arriving an
 * hour early.
 *
 * @param {object} device
 * @param {number} nowUtcMs
 * @return {boolean}
 */
function isQuietNow(device, nowUtcMs) {
  if (!device || device.quietEnabled !== true) return false;

  const start = asMinute(device.quietStartMin);
  const end = asMinute(device.quietEndMin);
  if (start === null || end === null) return false;

  // A zero-length window is off, not permanently on. Treating it as
  // always-quiet would silence a device forever because someone set both
  // ends of the picker to the same value.
  if (start === end) return false;

  const now = localMinutes(nowUtcMs, asOffset(device.utcOffsetMinutes));

  return start < end ?
    now >= start && now < end :
    // Wraps past midnight, the normal case for a sleep window.
    now >= start || now < end;
}

/**
 * Chooses which devices should receive an alert about `slug`.
 *
 * @param {Array<object>} devices
 * @param {string} slug
 * @param {number} nowUtcMs
 * @return {string[]} unique tokens
 */
function selectRecipients(devices, slug, nowUtcMs) {
  const seen = new Set();

  for (const device of devices || []) {
    if (!device || typeof device.token !== "string") continue;
    if (device.token === "") continue;

    // The client sends the figures it wants alerts for, which is the
    // watchlist minus anything muted. Doing the subtraction on the client
    // keeps per-figure settings a purely local concern.
    const slugs = Array.isArray(device.slugs) ? device.slugs : [];
    if (!slugs.includes(slug)) continue;

    if (isQuietNow(device, nowUtcMs)) continue;

    seen.add(device.token);
  }

  return [...seen];
}

/**
 * Builds the FCM message for a detected spike.
 *
 * `data` values must every one be strings — FCM rejects the whole send if
 * any is a number, and the failure surfaces as an opaque invalid-argument
 * rather than pointing at the offending key.
 *
 * @param {object} args
 * @param {string} args.slug
 * @param {{title: string, body: string}} args.message from buildAlertMessage
 * @param {{zScore: number, change: number, direction: string}} args.spike
 * @param {number} args.score
 * @return {object} an FCM message minus its `tokens`
 */
function buildPushPayload({slug, message, spike, score}) {
  return {
    notification: {
      title: message.title,
      body: message.body,
    },
    data: {
      // Consumed by the client to deep-link straight to the figure.
      kind: "spike",
      slug: String(slug),
      score: String(Math.round(score)),
      change: String(Math.round(spike.change)),
      direction: String(spike.direction),
      zScore: spike.zScore.toFixed(2),
    },
    android: {
      // A sentiment spike is the one thing this app is allowed to
      // interrupt for, and it is rate-limited to once per figure per day
      // upstream, so high priority is honest rather than abusive.
      priority: "high",
      notification: {
        // Must match the channel the client creates, or Android 8+ drops
        // the notification silently.
        channelId: "crititrack_alerts",
        // Referenced by name; the drawable ships with the app.
        icon: "ic_stat_crititrack",
        // Collapse on the figure, so a device that was offline for a week
        // shows one notification per figure rather than seven.
        tag: `spike-${slug}`,
      },
    },
    apns: {
      headers: {"apns-priority": "10"},
      payload: {aps: {sound: "default", threadId: `spike-${slug}`}},
    },
  };
}

/**
 * Splits tokens into batches FCM will accept.
 *
 * @param {string[]} tokens
 * @param {number} [size]
 * @return {string[][]}
 */
function chunkTokens(tokens, size = MULTICAST_LIMIT) {
  const limit = Math.max(1, Math.min(size, MULTICAST_LIMIT));
  const out = [];
  for (let i = 0; i < tokens.length; i += limit) {
    out.push(tokens.slice(i, i + limit));
  }
  return out;
}

/**
 * Picks out the tokens that are permanently dead, from an FCM batch
 * response paired with the tokens that produced it.
 *
 * @param {{responses: Array<object>}} batchResponse
 * @param {string[]} tokens same order as responses
 * @return {string[]}
 */
function deadTokensFrom(batchResponse, tokens) {
  const responses =
    batchResponse && Array.isArray(batchResponse.responses) ?
      batchResponse.responses :
      [];

  const dead = [];
  responses.forEach((r, i) => {
    if (!r || r.success) return;
    const code = r.error && r.error.code;
    if (DEAD_TOKEN_CODES.has(code)) dead.push(tokens[i]);
  });

  return dead.filter((t) => typeof t === "string" && t !== "");
}

/**
 * Coerces a stored minute-of-day, rejecting anything out of range.
 *
 * @param {*} v
 * @return {number|null}
 */
function asMinute(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.floor(v);
  return n >= 0 && n < MINUTES_PER_DAY ? n : null;
}

/**
 * Coerces a stored UTC offset. Real offsets run from -12:00 to +14:00;
 * anything else is corrupt and treated as UTC rather than shifting a
 * device into a window it never chose.
 *
 * @param {*} v
 * @return {number}
 */
function asOffset(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  const n = Math.trunc(v);
  return n >= -720 && n <= 840 ? n : 0;
}

module.exports = {
  isQuietNow,
  localMinutes,
  selectRecipients,
  buildPushPayload,
  chunkTokens,
  deadTokensFrom,
  MULTICAST_LIMIT,
};
