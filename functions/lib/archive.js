"use strict";

/**
 * Builds a Wayback Machine link for a cited source.
 *
 * Every record in CritiTrack cites a URL, and URLs rot — an outlet
 * restructures, a story is pulled, a domain lapses. A reader who comes
 * back to a profile a year later should still be able to reach what the
 * record was based on. `web.archive.org`'s "latest capture" redirect
 * (`/web/2/<url>`) resolves to the most recent snapshot the Archive
 * holds, or to its "save this page" flow if it holds none — so the link
 * is useful even before anyone has archived the page.
 *
 * This does not *create* a snapshot (that would be an outbound request
 * per source on every assembly); it just gives the reader a one-click
 * path to one. Only https URLs that pass the shared safety policy get a
 * link — an unsafe original is not made reachable by wrapping it.
 */

const {parseSafeUrl} = require("./safeUrl");

const WAYBACK_LATEST = "https://web.archive.org/web/2/";

/**
 * @param {unknown} rawUrl the source URL as stored on a record
 * @return {string|null} a Wayback "latest capture" URL, or null
 */
function archiveUrl(rawUrl) {
  const parsed = parseSafeUrl(rawUrl);
  if (parsed === null) return null;
  // The target is appended un-encoded: Wayback expects the literal URL
  // after /web/2/, and encodeURIComponent here would send it a
  // double-encoded string it cannot resolve.
  return WAYBACK_LATEST + parsed.toString();
}

/**
 * Adds an `archiveUrl` field to every item in a list that has a usable
 * `url`. Mutates in place and returns the list, matching how assemble.js
 * tags media items.
 *
 * @param {Array<{url?: string, archiveUrl?: string|null}>} items
 * @return {Array<object>}
 */
function annotateArchiveLinks(items) {
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item !== "object") continue;
    item.archiveUrl = archiveUrl(item.url);
  }
  return items;
}

module.exports = {archiveUrl, annotateArchiveLinks, WAYBACK_LATEST};
