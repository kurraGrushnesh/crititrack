"use strict";

/**
 * How much one media item should count toward the aggregate.
 *
 * The previous aggregation weighted every source at exactly one third,
 * which says a front-page wire story and a 200-view upload are equally
 * informative about public sentiment. They are not. Weighting by reach is
 * a claim we can defend; a flat average is one we cannot.
 *
 * Weights are deliberately compressed — a logarithm on view counts, a
 * small tier table on outlets — because reach is a proxy, not a
 * measurement, and a proxy should not be allowed to dominate.
 */

/** Outlets whose reach is high enough to be worth naming explicitly. */
const MAJOR_OUTLETS = new Set([
  "reuters.com", "apnews.com", "bbc.co.uk", "bbc.com", "nytimes.com",
  "washingtonpost.com", "theguardian.com", "wsj.com", "ft.com",
  "cnn.com", "npr.org", "bloomberg.com", "economist.com",
  "variety.com", "hollywoodreporter.com", "deadline.com",
  "thetimes.co.uk", "telegraph.co.uk", "aljazeera.com",
  "thehindu.com", "indianexpress.com", "timesofindia.indiatimes.com",
  "ndtv.com", "hindustantimes.com",
]);

/**
 * NewsAPI reports a display name ("The Guardian") where GDELT reports a
 * domain ("theguardian.com"). Without this the same outlet would be
 * weighted differently depending on which source happened to find it.
 */
const OUTLET_ALIASES = new Map([
  ["reuters", "reuters.com"],
  ["associated press", "apnews.com"],
  ["ap news", "apnews.com"],
  ["bbc news", "bbc.co.uk"],
  ["bbc", "bbc.co.uk"],
  ["the new york times", "nytimes.com"],
  ["the washington post", "washingtonpost.com"],
  ["the guardian", "theguardian.com"],
  ["the wall street journal", "wsj.com"],
  ["financial times", "ft.com"],
  ["cnn", "cnn.com"],
  ["npr", "npr.org"],
  ["bloomberg", "bloomberg.com"],
  ["the economist", "economist.com"],
  ["variety", "variety.com"],
  ["the hollywood reporter", "hollywoodreporter.com"],
  ["deadline", "deadline.com"],
  ["al jazeera english", "aljazeera.com"],
  ["the hindu", "thehindu.com"],
  ["the indian express", "indianexpress.com"],
  ["the times of india", "timesofindia.indiatimes.com"],
  ["ndtv", "ndtv.com"],
  ["hindustan times", "hindustantimes.com"],
]);

const MAJOR_WEIGHT = 2.5;
const KNOWN_WEIGHT = 1.5;
const DEFAULT_WEIGHT = 1.0;

/** Ceiling on any single item, so one viral post cannot swamp the rest. */
const MAX_WEIGHT = 3.0;

/**
 * @param {object} item a media item
 * @return {number} weight, at least 0.5 and at most MAX_WEIGHT
 */
function weightFor(item) {
  if (!item || typeof item !== "object") return DEFAULT_WEIGHT;

  switch (item.type) {
    case "news":
      return outletWeight(item.source, item.url);
    case "youtube":
      return viewWeight(item.viewCount);
    case "instagram":
      return viewWeight(item.likeCount);
    default:
      return DEFAULT_WEIGHT;
  }
}

/**
 * @param {unknown} source
 * @param {unknown} url
 * @return {number}
 */
function outletWeight(source, url) {
  const host = hostOf(source) || hostOf(url);
  if (!host) return DEFAULT_WEIGHT;
  if (MAJOR_OUTLETS.has(host)) return MAJOR_WEIGHT;
  // A recognisable domain still beats an unattributed aggregator.
  return host.includes(".") ? KNOWN_WEIGHT : DEFAULT_WEIGHT;
}

/**
 * Log-scaled so the difference between 1k and 10k views matters about as
 * much as the difference between 10k and 100k — which is how reach
 * actually behaves.
 *
 * @param {unknown} count
 * @return {number}
 */
function viewWeight(count) {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_WEIGHT;
  return clamp(0.5 + Math.log10(n + 1) / 3, 0.5, MAX_WEIGHT);
}

/**
 * Extracts a bare hostname from either a URL or an outlet name.
 *
 * @param {unknown} value
 * @return {string}
 */
function hostOf(value) {
  if (typeof value !== "string" || value.trim() === "") return "";
  const raw = value.trim().toLowerCase();

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      return new URL(raw).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  }

  if (raw.includes(".")) return raw.replace(/^www\./, "");

  // A display name such as "The Guardian" resolves to the same domain
  // GDELT would have reported, so one outlet gets one weight regardless
  // of which source surfaced it.
  return OUTLET_ALIASES.get(raw) || "";
}

/** @param {number} v @param {number} lo @param {number} hi @return {number} */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

module.exports = {
  weightFor,
  outletWeight,
  viewWeight,
  hostOf,
  MAJOR_OUTLETS,
  OUTLET_ALIASES,
  MAX_WEIGHT,
};
