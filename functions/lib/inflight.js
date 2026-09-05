"use strict";

/**
 * Shares one in-flight async operation across concurrent callers keyed
 * by `key`, so two requests that arrive together for the same
 * not-yet-cached entity trigger one expensive assembly instead of two
 * duplicate Groq/News/YouTube pipelines.
 *
 * The map entry is removed as soon as the operation settles — success
 * or failure — so a later request for the same key always starts a
 * fresh attempt rather than replaying a stale result or a stuck
 * failure. This is request coalescing only: it shares work between
 * requests that overlap in time, and is not a cache (see store.js's
 * `readCelebrityCache`/`writeCelebrity` for that).
 *
 * @param {Map<string, Promise<any>>} inflight the shared registry —
 *   typically one long-lived `Map` per process/route.
 * @param {string} key stable identity for the operation (e.g. the
 *   canonical entity slug — never a raw, unresolved search string).
 * @param {() => Promise<any>} factory started only when nothing is
 *   already in flight for `key`.
 * @return {Promise<any>} the shared result — every concurrent caller
 *   for the same key resolves or rejects together.
 */
function coalesce(inflight, key, factory) {
  const existing = inflight.get(key);
  if (existing) return existing;

  // `factory()` is invoked synchronously (not deferred behind an extra
  // microtask) and registered before anything else runs, so a second
  // caller arriving before this line returns — even in the same
  // synchronous tick — sees the entry already in `inflight`.
  const promise = Promise.resolve(factory()).finally(() => {
    // Only clear this exact entry — a factory that recursively (or via
    // a retry) re-coalesces the same key must not have its own newer
    // promise evicted by an older one settling.
    if (inflight.get(key) === promise) inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

module.exports = {coalesce};
