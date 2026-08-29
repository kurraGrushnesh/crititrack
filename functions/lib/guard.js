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

const {getAuth} = require("firebase-admin/auth");
const {getAppCheck} = require("firebase-admin/app-check");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const logger = require("./logger");

/** True inside `firebase emulators:start`. */
const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === "true";

// ── Tunables ────────────────────────────────────────────────────────
const RATE_PER_HOUR = 20;
const RATE_PER_DAY = 100;
/** Upper bound on paid lookups per day across all users. */
const GLOBAL_DAILY_LOOKUPS = 500;

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
  if (IS_EMULATOR) return;

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

module.exports = {
  requireUser,
  requireAppCheck,
  consumeUserQuota,
  consumeGlobalBudget,
  GuardError,
  IS_EMULATOR,
  RATE_PER_HOUR,
  RATE_PER_DAY,
  GLOBAL_DAILY_LOOKUPS,
  secondsUntilNextHour,
  secondsUntilNextDay,
};
