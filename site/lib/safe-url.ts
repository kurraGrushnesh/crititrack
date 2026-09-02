/**
 * URL safety checks for links that did not originate with us.
 *
 * This is the web twin of `lib/core/security/safe_url.dart`. Source links
 * on the site come from the same third-party APIs and language-model
 * output the app handles, and a profile page renders them as clickable
 * anchors. The policy that decides which links are openable has to be the
 * same one in both clients, so the rules below are copied from the Dart
 * file. A change to the policy needs the identical change there, plus a
 * matching case in both test suites.
 *
 * The policy is deliberately narrow, because every legitimate link we
 * handle is an ordinary web page:
 *
 *   - `https` only. `http` is downgrade-prone, and `javascript:`,
 *     `data:`, `file:`, `blob:`, `intent:` and friends have no business
 *     being opened from a news reference.
 *   - No embedded credentials, which are almost always a phishing signal
 *     (`https://apple.com@evil.example`).
 *   - A real host, so `https:///foo` and similar oddities are rejected.
 */

const SCHEME = "https:";

/**
 * Parses `raw` and returns a {@link URL} only if it is safe to open.
 *
 * Returns null for anything malformed or disallowed, so callers can
 * render a blocked state instead of guessing. Never throws: the URL
 * constructor raises on malformed input, and a bad link must not be able
 * to crash the component that displays it.
 */
export function parseSafeUrl(raw: string | null | undefined): URL | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Reject an empty authority (`https:///path`) before parsing. The
  // WHATWG URL parser collapses the extra slash and reads `path` as the
  // host, where Dart's `Uri` leaves the host empty and rejects it. This
  // guard keeps the two clients in agreement.
  if (/^https:\/\/(?:\/|$)/i.test(trimmed)) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  return isSafeUrl(url) ? url : null;
}

/**
 * Whether `url` may be opened. Used both before rendering an anchor and
 * anywhere a redirect target needs to be held to the same policy the
 * original link was.
 */
export function isSafeUrl(url: URL): boolean {
  if (url.protocol.toLowerCase() !== SCHEME) return false;
  if (url.host.length === 0) return false;
  if (url.hostname.length === 0) return false;
  // "https://trusted.example@attacker.example" renders as the trusted
  // host in a truncated URL bar but resolves to the attacker's.
  if (url.username.length > 0 || url.password.length > 0) return false;
  return true;
}

/**
 * Host shown to the user, with a leading `www.` dropped. Empty string
 * when the URL is not one we would open.
 */
export function displayHost(raw: string | null | undefined): string {
  const url = parseSafeUrl(raw);
  if (url == null) return "";
  const host = url.hostname;
  return host.startsWith("www.") ? host.slice(4) : host;
}
