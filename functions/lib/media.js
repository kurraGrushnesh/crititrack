"use strict";

const {fetchWithTimeout} = require("./httpUtil");
const logger = require("./logger");

/**
 * Latest news articles about a name (NewsAPI /v2/everything).
 * Returns [] on any soft failure — missing coverage is a valid state.
 *
 * @param {string} apiKey
 * @param {string} name
 * @return {Promise<object[]>}
 */
async function fetchNews(apiKey, name) {
  if (!apiKey) return [];
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", name);
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("apiKey", apiKey);

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      logger.warn(`NewsAPI HTTP ${res.status}`);
      return [];
    }
    const json = await res.json();
    return (json.articles || []).map((a) => ({
      id: String(hash(a.url || a.title || "")),
      type: "news",
      title: a.title || "Untitled",
      url: a.url || "",
      thumbnailUrl: a.urlToImage || null,
      source: (a.source && a.source.name) || "Unknown",
      publishedAt: a.publishedAt || null,
      description: a.description || null,
    }));
  } catch (e) {
    logger.warn(`NewsAPI failed: ${e.message}`);
    return [];
  }
}

/**
 * Top YouTube videos for a name (YouTube Data API v3 search).
 *
 * @param {string} apiKey
 * @param {string} name
 * @return {Promise<object[]>}
 */
async function fetchVideos(apiKey, name) {
  if (!apiKey) return [];
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", name);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "5");
  url.searchParams.set("key", apiKey);

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      logger.warn(`YouTube HTTP ${res.status}`);
      return [];
    }
    const json = await res.json();
    return (json.items || []).map((i) => {
      const videoId = (i.id && i.id.videoId) || "";
      const s = i.snippet || {};
      return {
        id: videoId,
        type: "youtube",
        title: s.title || "Untitled Video",
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        source: "YouTube",
        channel: s.channelTitle || null,
        publishedAt: s.publishedAt || null,
        description: s.description || null,
      };
    });
  } catch (e) {
    logger.warn(`YouTube failed: ${e.message}`);
    return [];
  }
}

/** Small deterministic string hash for stable media ids. */
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}


/**
 * Global news via GDELT's DOC 2.0 API.
 *
 * Preferred over the NewsAPI free tier, which is licensed for development
 * only, delays results by 24 hours and allows 100 requests a day. GDELT is
 * an open platform with no key and no quota, and indexes far more outlets.
 *
 * Note: GDELT was not reachable from the machine this was written on, so
 * the parsing below is covered by fixture tests rather than a live call.
 * It degrades to [] like every other source, so if it is unreachable in
 * production too, the feed simply falls back to the other sources.
 *
 * @param {string} name
 * @param {number} [limit]
 * @return {Promise<object[]>}
 */
async function fetchGdelt(name, limit = 10) {
  const url = new URL("https://api.gdeltproject.org/api/v2/doc/doc");
  // Quoting keeps a multi-word name together instead of matching either
  // word anywhere in an article.
  url.searchParams.set("query", `"${name}" sourcelang:english`);
  url.searchParams.set("mode", "artlist");
  url.searchParams.set("maxrecords", String(limit));
  url.searchParams.set("sort", "datedesc");
  url.searchParams.set("format", "json");

  try {
    const res = await fetchWithTimeout(
        url,
        {headers: {"User-Agent": "CritiTrack/1.0 (https://crititrack.app)"}},
        12000,
    );
    if (!res.ok) {
      logger.warn(`GDELT HTTP ${res.status}`);
      return [];
    }
    return parseGdelt(await res.json());
  } catch (e) {
    logger.warn(`GDELT failed: ${e.message}`);
    return [];
  }
}

/**
 * Maps a GDELT article list onto our media shape.
 *
 * Exported so the mapping can be tested without a network call.
 *
 * @param {any} json
 * @return {object[]}
 */
function parseGdelt(json) {
  const articles = (json && json.articles) || [];
  if (!Array.isArray(articles)) return [];

  return articles
      .filter((a) => a && a.url && a.title)
      .map((a) => ({
        id: String(hash(a.url)),
        type: "news",
        title: String(a.title).trim(),
        url: a.url,
        thumbnailUrl: a.socialimage || null,
        source: a.domain || "Unknown",
        publishedAt: parseGdeltDate(a.seendate),
        description: null,
      }));
}

/**
 * GDELT stamps articles as `20260828T164028Z`, which `Date.parse` does not
 * understand. Expanded to ISO 8601 so the app can sort and format it like
 * every other source.
 *
 * @param {unknown} raw
 * @return {string|null}
 */
function parseGdeltDate(raw) {
  if (typeof raw !== "string") return null;
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const [, y, mo, d, h, mi, sec] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${sec}Z`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Removes items that point at the same story.
 *
 * Sources overlap heavily — an article syndicated to three outlets is one
 * story, and counting it three times would skew both the feed and the
 * sentiment aggregate toward whatever happened to be widely syndicated.
 *
 * @param {object[]} items
 * @return {object[]}
 */
function dedupe(items) {
  const seenUrl = new Set();
  const seenTitle = new Set();
  const out = [];

  for (const item of items) {
    const url = (item.url || "").toLowerCase().replace(/[?#].*$/, "");
    // Normalising the title catches the same story under two URLs.
    const title = (item.title || "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (url && seenUrl.has(url)) continue;
    if (title && seenTitle.has(title)) continue;

    if (url) seenUrl.add(url);
    if (title) seenTitle.add(title);
    out.push(item);
  }

  return out;
}

module.exports = {
  fetchNews,
  fetchVideos,
  fetchGdelt,
  parseGdelt,
  parseGdeltDate,
  dedupe,
};
