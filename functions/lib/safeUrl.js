"use strict";

/**
 * URL safety policy for links that did not originate with us.
 *
 * This is the Node twin of `lib/core/security/safe_url.dart` and
 * `site/lib/safe-url.ts`. The three must agree: a link one client would
 * open, the others open too, and a link one rejects, all reject. A change
 * to the policy needs the same change in all three, plus a matching test
 * case in each suite.
 *
 *   - https only. http is downgrade-prone; javascript:, data:, file:,
 *     blob:, intent: and friends are not web pages.
 *   - No embedded credentials (https://apple.com@evil.example), which are
 *     a phishing signal.
 *   - A real, non-empty host.
 */

const SCHEME = "https:";

/**
 * Parses `raw` and returns a URL only if it is safe to open. Returns null
 * for anything malformed or disallowed. Never throws.
 *
 * @param {unknown} raw
 * @return {URL|null}
 */
function parseSafeUrl(raw) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Reject an empty authority ("https:///path") before parsing: the
  // WHATWG parser collapses the slash and reads "path" as the host,
  // where Dart's Uri leaves the host empty and rejects it.
  if (/^https:\/\/(?:\/|$)/i.test(trimmed)) return null;

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  return isSafeUrl(url) ? url : null;
}

/**
 * Whether `url` may be opened. Also used to hold a redirect target to the
 * same policy the original link was held to.
 *
 * @param {URL} url
 * @return {boolean}
 */
function isSafeUrl(url) {
  if (url.protocol.toLowerCase() !== SCHEME) return false;
  if (url.host.length === 0) return false;
  if (url.hostname.length === 0) return false;
  if (url.username.length > 0 || url.password.length > 0) return false;
  return true;
}

/**
 * Host shown to a user, with a leading `www.` dropped. Empty string when
 * the URL is not one we would open.
 *
 * @param {unknown} raw
 * @return {string}
 */
function displayHost(raw) {
  const url = parseSafeUrl(raw);
  if (url === null) return "";
  const host = url.hostname;
  return host.startsWith("www.") ? host.slice(4) : host;
}

module.exports = {parseSafeUrl, isSafeUrl, displayHost};
