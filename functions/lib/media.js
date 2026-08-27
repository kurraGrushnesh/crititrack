"use strict";

const {fetchWithTimeout} = require("./httpUtil");
const logger = require("firebase-functions/logger");

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

module.exports = {fetchNews, fetchVideos};
