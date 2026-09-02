"use strict";

/**
 * Perimeter controls for the public API (SEC-02).
 *
 * The endpoint spends real money on every call — Groq tokens, NewsAPI and
 * YouTube quota — so an unauthenticated, unmetered endpoint is a standing
 * invitation to run up the bill. Four layers sit in front of that spend:
 *
 *   1. Identity      — a verified Firebase ID token (anonymous is fine).
 *   2. Attestation   — App Check, so only builds we shipped can call in.
 *   3. Per-user rate — a token bucket keyed by uid.
 *   4. Global ceiling — a daily spend cap that trips a circuit breaker.
 *
 * Layers 3 and 4 keep their counters in Firestore. When Firestore is
 * unavailable the request is still allowed: an outage must degrade
 * metering, not take the product down. Layers 1 and 2 fail closed.
 *
 * In the Functions emulator every layer is relaxed, so local development
 * needs no console configuration.
 */

const crypto = require("node:crypto");

const {getAuth} = require("firebase-admin/auth");
const {getAppCheck} = require("firebase-admin/app-check");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const logger = require("./logger");

/** True inside `firebase emulators:start`. */
const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === "true";

/**
 * App Check attestation is enforced unless `APP_CHECK_ENFORCED=false` is
 * set in the environment.
 *
 * The web client can only produce an App Check token with a reCAPTCHA
 * Enterprise site key, which needs a Google Cloud console setup. A
 * deployment that has not done that yet can turn enforcement off: the
 * endpoint is still behind a Firebase ID token (anonymous is fine), the
 * per-user rate limit, and the global daily budget cap, so the spend is
 * still bounded. What is lost is the guarantee that a call came from a
 * build we published rather than a script.
 */
const APP_CHECK_ENFORCED = process.env.APP_CHECK_ENFORCED !== "false";

// ── Tunables ────────────────────────────────────────────────────────
const RATE_PER_HOUR = 20;
const RATE_PER_DAY = 100;
/** Upper bound on paid lookups per day across all users. */
const GLOBAL_DAILY_LOOKUPS = 500;

/**
 * Correction reports are not gated by App Check or a Firebase token --
 * the marketing-site form has no way to obtain either -- so the only
 * thing standing between the endpoint and a spam flood is a per-IP cap.
 * Kept deliberately low: a real person filing corrections sends one or
 * two, not dozens.
 */
const CORRECTION_PER_HOUR = 5;
const CORRECTION_PER_DAY = 20;

const USAGE = "usage";
const COUNTERS = "counters";

class GuardError extends Error {
  /**
   * @param {string} code @param {string} message @param {number} status
   * @param {Record<string, string>} [headers]
   */
  constructor(code, message, status, headers = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.headers = headers;
  }
}

/**
 * Extracts and verifies the caller's Firebase ID token.
 *
 * @param {import("express").Request} req
 * @return {Promise<string>} the caller's uid
 * @throws {GuardError} 401 when the token is absent or invalid
 */
async function requireUser(req) {
  if (IS_EMULATOR) return "emulator-user";

  const header = req.get("Authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    throw new GuardError(
        "unauthenticated",
        "A Firebase ID token is required.",
        401,
    );
  }

  try {
    const decoded = await getAuth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch (e) {
    logger.warn(`ID token rejected: ${e.message}`);
    throw new GuardError("unauthenticated", "Invalid or expired token.", 401);
  }
}

/**
 * Verifies the App Check token, proving the call came from a build we
 * published rather than a script.
 *
 * @param {import("express").Request} req
 * @return {Promise<void>}
 * @throws {GuardError} 401 when attestation fails
 */
async function requireAppCheck(req) {
  if (IS_EMULATOR || !APP_CHECK_ENFORCED) return;

  const token = req.get("X-Firebase-AppCheck");
  if (!token) {
    throw new GuardError(
        "attestation_required",
        "App Check token missing.",
        401,
    );
  }

  try {
    await getAppCheck().verifyToken(token);
  } catch (e) {
    logger.warn(`App Check rejected: ${e.message}`);
    throw new GuardError("attestation_failed", "App Check failed.", 401);
  }
}

/**
 * Consumes one unit from this user's hourly and daily budget.
 *
 * Uses a Firestore transaction so concurrent requests cannot both read a
 * stale count and slip past the limit.
 *
 * @param {string} uid
 * @return {Promise<void>}
 * @throws {GuardError} 429 when either budget is exhausted
 */
async function consumeUserQuota(uid) {
  if (IS_EMULATOR) return;

  const now = new Date();
  const hourKey = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const ref = getFirestore().collection(USAGE).doc(uid);

  try {
    await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const d = snap.exists ? snap.data() : {};

      const hourCount = d.hourKey === hourKey ? (d.hourCount || 0) : 0;
      const dayCount = d.dayKey === dayKey ? (d.dayCount || 0) : 0;

      if (hourCount >= RATE_PER_HOUR) {
        throw new GuardError(
            "rate_limited",
            `Limit of ${RATE_PER_HOUR} lookups per hour reached.`,
            429,
            {"Retry-After": String(secondsUntilNextHour(now))},
        );
      }
      if (dayCount >= RATE_PER_DAY) {
        throw new GuardError(
            "rate_limited",
            `Limit of ${RATE_PER_DAY} lookups per day reached.`,
            429,
            {"Retry-After": String(secondsUntilNextDay(now))},
        );
      }

      tx.set(
          ref,
          {
            hourKey, hourCount: hourCount + 1,
            dayKey, dayCount: dayCount + 1,
            updatedAt: FieldValue.serverTimestamp(),
          },
          {merge: true},
      );
    });
  } catch (e) {
    if (e instanceof GuardError) throw e;
    // Metering is best-effort: a Firestore outage must not deny service.
    logger.warn(`quota check skipped for ${uid}: ${e.message}`);
  }
}

/**
 * Global circuit breaker. Bounds worst-case daily spend no matter how many
 * users, or how badly a client loops.
 *
 * @return {Promise<void>}
 * @throws {GuardError} 503 once the day's ceiling is reached
 */
async function consumeGlobalBudget() {
  if (IS_EMULATOR) return;

  const dayKey = new Date().toISOString().slice(0, 10);
  const ref = getFirestore().collection(COUNTERS).doc(`lookups-${dayKey}`);

  try {
    await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = snap.exists ? (snap.data().count || 0) : 0;

      if (count >= GLOBAL_DAILY_LOOKUPS) {
        throw new GuardError(
            "capacity_reached",
            "Daily capacity reached. Cached results are still available; " +
            "fresh lookups resume tomorrow.",
            503,
            {"Retry-After": String(secondsUntilNextDay(new Date()))},
        );
      }

      tx.set(ref, {count: count + 1, dayKey}, {merge: true});
    });
  } catch (e) {
    if (e instanceof GuardError) throw e;
    logger.warn(`global budget check skipped: ${e.message}`);
  }
}

/** @param {Date} now @return {number} */
function secondsUntilNextHour(now) {
  const next = new Date(now);
  next.setUTCMinutes(60, 0, 0);
  return Math.max(1, Math.ceil((next - now) / 1000));
}

/** @param {Date} now @return {number} */
function secondsUntilNextDay(now) {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((next - now) / 1000));
}

/**
 * The caller's IP, from `X-Forwarded-For` (the host sits behind a proxy)
 * with a fall back to the socket address. Returns "unknown" when nothing
 * usable is present rather than throwing.
 *
 * @param {import("express").Request} req
 * @return {string}
 */
function clientIp(req) {
  const fwd = req.headers && req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim();
  }
  return (
    (req.ip && String(req.ip)) ||
    (req.socket && req.socket.remoteAddress) ||
    "unknown"
  );
}

/**
 * A short, stable, non-reversible tag for an IP. Stored on the counter
 * document and the correction record so repeated abuse from one address
 * can be spotted, without keeping the address itself.
 *
 * @param {string} ip
 * @return {string} 16 lowercase hex chars
 */
function hashIp(ip) {
  return crypto
      .createHash("sha256")
      .update(`crititrack:${ip}`)
      .digest("hex")
      .slice(0, 16);
}

/**
 * Consumes one unit from this IP's correction-report budget. Same
 * transaction-guarded, best-effort-on-outage shape as
 * {@link consumeUserQuota}.
 *
 * @param {import("express").Request} req
 * @return {Promise<string>} the IP hash, for the stored record
 * @throws {GuardError} 429 when either budget is exhausted
 */
async function consumeCorrectionQuota(req) {
  const tag = hashIp(clientIp(req));
  if (IS_EMULATOR) return tag;

  const now = new Date();
  const hourKey = now.toISOString().slice(0, 13);
  const dayKey = now.toISOString().slice(0, 10);
  const ref = getFirestore().collection(USAGE).doc(`corr_${tag}`);

  try {
    await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const d = snap.exists ? snap.data() : {};

      const hourCount = d.hourKey === hourKey ? (d.hourCount || 0) : 0;
      const dayCount = d.dayKey === dayKey ? (d.dayCount || 0) : 0;

      if (hourCount >= CORRECTION_PER_HOUR) {
        throw new GuardError(
            "rate_limited",
            `Limit of ${CORRECTION_PER_HOUR} reports per hour reached.`,
            429,
            {"Retry-After": String(secondsUntilNextHour(now))},
        );
      }
      if (dayCount >= CORRECTION_PER_DAY) {
        throw new GuardError(
            "rate_limited",
            `Limit of ${CORRECTION_PER_DAY} reports per day reached.`,
            429,
            {"Retry-After": String(secondsUntilNextDay(now))},
        );
      }

      tx.set(
          ref,
          {
            hourKey, hourCount: hourCount + 1,
            dayKey, dayCount: dayCount + 1,
            updatedAt: FieldValue.serverTimestamp(),
          },
          {merge: true},
      );
    });
  } catch (e) {
    if (e instanceof GuardError) throw e;
    logger.warn(`correction quota check skipped for ${tag}: ${e.message}`);
  }
  return tag;
}

module.exports = {
  requireUser,
  requireAppCheck,
  consumeUserQuota,
  consumeGlobalBudget,
  consumeCorrectionQuota,
  clientIp,
  hashIp,
  GuardError,
  IS_EMULATOR,
  APP_CHECK_ENFORCED,
  RATE_PER_HOUR,
  RATE_PER_DAY,
  GLOBAL_DAILY_LOOKUPS,
  CORRECTION_PER_HOUR,
  CORRECTION_PER_DAY,
  secondsUntilNextHour,
  secondsUntilNextDay,
};
