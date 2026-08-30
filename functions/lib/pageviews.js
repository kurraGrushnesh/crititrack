"use strict";

/**
 * Daily Wikipedia pageviews for a public figure.
 *
 * ## Why this exists
 *
 * Sentiment history is only recorded when a refresh actually runs, so a
 * newly tracked figure genuinely has none and the app says so. That is
 * honest, and it is also an empty chart on the screen people look at
 * first.
 *
 * Pageviews close that gap without inventing anything. The Wikimedia
 * metrics API returns a real, retrospective daily series — free, keyless,
 * and measured by Wikimedia rather than by us.
 *
 * ## What it is not
 *
 * **This is attention, not sentiment.** A spike means people looked
 * someone up, not that opinion moved, and it carries no sign: an award
 * and an indictment both raise it. It is reported as its own series with
 * its own name and must never be blended into the sentiment score or
 * presented as one. The whole point of the ensemble is that a number
 * says where it came from.
 *
 * @see https://wikimedia.org/api/rest_v1/#/Pageviews%20data
 */

const {fetchWithTimeout} = require("./httpUtil");
const logger = require("./logger");

const BASE = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article";
const UA = "CritiTrack/1.0 (https://crititrack-f7430.web.app)";

/** How much history to ask for. */
const DAYS = 60;

/**
 * Yesterday, not today: the current day is incomplete and would always
 * read as a collapse in attention.
 */
const LAG_DAYS = 1;

/**
 * Fetches the daily pageview series for one article title.
 *
 * @param {string} title Wikipedia article title, e.g. "N. T. Rama Rao"
 * @param {Date} [now] injectable clock, for tests
 * @return {Promise<Array<{date: string, views: number}>>} empty on any miss
 */
async function fetchPageviews(title, now = new Date()) {
  const clean = String(title || "").trim();
  if (!clean) return [];

  const end = addDays(now, -LAG_DAYS);
  const start = addDays(end, -(DAYS - 1));

  // The title goes through encodeURIComponent, then the slashes that
  // survive are escaped again: an article like "AC/DC" would otherwise
  // split the path and 404.
  const article = encodeURIComponent(clean.replace(/\s+/g, "_"))
      .replace(/%2F/gi, "%252F");

  const url =
    `${BASE}/en.wikipedia/all-access/user/${article}` +
    `/daily/${stamp(start)}/${stamp(end)}`;

  try {
    const res = await fetchWithTimeout(url, {headers: {"User-Agent": UA}}, 8000);
    // 404 is the normal answer for a title with no article, which is not
    // an error worth logging on every unknown name.
    if (res.status === 404) return [];
    if (!res.ok) {
      logger.warn(`pageviews ${res.status} for "${clean}"`);
      return [];
    }

    const j = await res.json();
    const items = Array.isArray(j.items) ? j.items : [];

    return items
        .map((i) => ({
          date: isoFromStamp(i.timestamp),
          views: Number(i.views),
        }))
        .filter((p) => p.date && Number.isFinite(p.views) && p.views >= 0);
  } catch (e) {
    logger.warn(`pageviews failed for "${clean}": ${e.message}`);
    return [];
  }
}

/**
 * Summarises a series into the few numbers a screen actually shows.
 *
 * Pure, so the arithmetic is tested without touching the network.
 *
 * `peak` is reported as a date rather than a bare maximum because the
 * useful question is *when* attention spiked — that is the day whose
 * coverage is worth reading.
 *
 * @param {Array<{date: string, views: number}>} series
 * @return {{
 *   days: number, total: number, mean: number, median: number,
 *   peak: {date: string, views: number}|null,
 *   latest: {date: string, views: number}|null,
 *   changePct: number|null
 * }|null}
 */
function summarise(series) {
  if (!Array.isArray(series) || series.length === 0) return null;

  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const views = sorted.map((p) => p.views);
  const total = views.reduce((t, v) => t + v, 0);

  const peak = sorted.reduce((m, p) => (!m || p.views > m.views ? p : m), null);
  const latest = sorted[sorted.length - 1];

  // Last seven days against the seven before them. Week over week rather
  // than day over day, because a single weekday is noise: every article
  // has a weekly rhythm.
  let changePct = null;
  if (sorted.length >= 14) {
    const tail = views.slice(-7).reduce((t, v) => t + v, 0);
    const prev = views.slice(-14, -7).reduce((t, v) => t + v, 0);
    if (prev > 0) changePct = Math.round(((tail - prev) / prev) * 100);
  }

  return {
    days: sorted.length,
    total,
    mean: Math.round(total / sorted.length),
    median: median(views),
    peak,
    latest,
    changePct,
  };
}

/** @param {number[]} xs @return {number} */
function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** @param {Date} d @param {number} n @return {Date} */
function addDays(d, n) {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

/** YYYYMMDD, which is the format the metrics API takes. */
function stamp(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** "2026070100" -> "2026-07-01" */
function isoFromStamp(ts) {
  const s = String(ts || "");
  if (!/^\d{8}/.test(s)) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

module.exports = {fetchPageviews, summarise, DAYS, stamp, isoFromStamp};
