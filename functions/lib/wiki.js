"use strict";

const {fetchWithTimeout} = require("./httpUtil");
const logger = require("./logger");

/**
 * Portrait image + short extract for a public figure, from the Wikipedia
 * REST summary endpoint. No API key, no auth. Returns null on any miss
 * (unknown page, disambiguation, network error) so the caller can treat
 * the image as simply unavailable.
 *
 * @param {string} name
 * @return {Promise<{imageUrl: string|null, extract: string|null}|null>}
 */
async function fetchWikiSummary(name) {
  const title = encodeURIComponent(name.trim().replace(/\s+/g, "_"));
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;

  try {
    const res = await fetchWithTimeout(
        url,
        // A contact URL that resolves, as Wikimedia's policy asks.
        {
          headers: {
            "User-Agent": "CritiTrack/1.0 (https://crititrack-f7430.web.app)",
          },
        },
        8000,
    );
    if (!res.ok) return null;

    const j = await res.json();
    if (j.type === "disambiguation") return null;

    const imageUrl =
      (j.originalimage && j.originalimage.source) ||
      (j.thumbnail && j.thumbnail.source) ||
      null;

    return {imageUrl, extract: j.extract || null};
  } catch (e) {
    logger.warn(`wiki summary failed for "${name}": ${e.message}`);
    return null;
  }
}

module.exports = {fetchWikiSummary};
