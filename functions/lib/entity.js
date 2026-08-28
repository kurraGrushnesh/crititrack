"use strict";

/**
 * Entity resolution against Wikidata.
 *
 * Every paid lookup is keyed by a resolved entity rather than the string
 * the user typed. That buys three things at once:
 *
 *   1. **Cost.** "zendaya", "Zendaya" and "Zendayaa" collapse to one
 *      cache entry instead of three separate rounds of Groq, NewsAPI and
 *      YouTube calls.
 *   2. **Correctness.** The canonical label is what gets sent upstream,
 *      so a misspelling still returns the right person.
 *   3. **Scope.** Wikidata says whether an entity is a human and how
 *      well-documented it is, which is how the public-figure-only rule
 *      from the editorial policy is actually enforced rather than merely
 *      stated.
 *
 * Resolution is best-effort: if Wikidata is unreachable the caller falls
 * back to the raw name. Failing to resolve must degrade the cache key,
 * never the product.
 */

const logger = require("firebase-functions/logger");
const {fetchWithTimeout} = require("./httpUtil");

const API = "https://www.wikidata.org/w/api.php";
const UA = "CritiTrack/1.0 (https://crititrack.app)";

/** Wikidata item id for "human". */
const HUMAN = "Q5";

/** "instance of" property. */
const INSTANCE_OF = "P31";

/** How many search hits to inspect. The person is rarely the top hit —
 * a search for "Zendaya" returns the given name first, then the album,
 * with the actress second — so a naive first-result pick resolves the
 * wrong entity. */
const CANDIDATES = 5;

/**
 * Resolves a free-text name to a single human on Wikidata.
 *
 * @param {string} name a validated name from lib/validate.js
 * @return {Promise<{
 *   qid: string, label: string, description: string, aliases: string[]
 * }|null>} null when nothing suitable was found
 */
async function resolvePerson(name) {
  try {
    const hits = await search(name);
    if (hits.length === 0) return null;

    const entities = await describe(hits.map((h) => h.id));

    // Search results are ordered by relevance, so the first hit that is
    // actually a human is the best human match.
    for (const hit of hits) {
      const e = entities[hit.id];
      if (!e) continue;
      if (!isHuman(e)) continue;

      return {
        qid: hit.id,
        label: labelOf(e) || hit.label || name,
        description: descriptionOf(e) || hit.description || "",
        aliases: aliasesOf(e),
      };
    }

    return null;
  } catch (e) {
    logger.warn(`entity resolution failed for "${name}": ${e.message}`);
    return null;
  }
}

/**
 * @param {string} name
 * @return {Promise<Array<{id: string, label: string, description: string}>>}
 */
async function search(name) {
  const u = new URL(API);
  u.searchParams.set("action", "wbsearchentities");
  u.searchParams.set("search", name);
  u.searchParams.set("language", "en");
  u.searchParams.set("uselang", "en");
  u.searchParams.set("format", "json");
  u.searchParams.set("limit", String(CANDIDATES));
  u.searchParams.set("type", "item");

  const res = await fetchWithTimeout(u, {headers: {"User-Agent": UA}}, 8000);
  if (!res.ok) return [];

  const j = await res.json();
  return (j.search || []).map((x) => ({
    id: x.id,
    label: x.label || "",
    description: x.description || "",
  }));
}

/**
 * @param {string[]} ids
 * @return {Promise<Record<string, object>>}
 */
async function describe(ids) {
  if (ids.length === 0) return {};

  const u = new URL(API);
  u.searchParams.set("action", "wbgetentities");
  u.searchParams.set("ids", ids.join("|"));
  u.searchParams.set("props", "claims|labels|descriptions|aliases");
  u.searchParams.set("languages", "en");
  u.searchParams.set("format", "json");

  const res = await fetchWithTimeout(u, {headers: {"User-Agent": UA}}, 8000);
  if (!res.ok) return {};

  const j = await res.json();
  return j.entities || {};
}

/** @param {object} entity @return {boolean} */
function isHuman(entity) {
  const claims = (entity.claims && entity.claims[INSTANCE_OF]) || [];
  return claims.some(
      (c) =>
        c.mainsnak &&
      c.mainsnak.datavalue &&
      c.mainsnak.datavalue.value &&
      c.mainsnak.datavalue.value.id === HUMAN,
  );
}

/** @param {object} e @return {string} */
function labelOf(e) {
  return (e.labels && e.labels.en && e.labels.en.value) || "";
}

/** @param {object} e @return {string} */
function descriptionOf(e) {
  return (e.descriptions && e.descriptions.en && e.descriptions.en.value) || "";
}

/** @param {object} e @return {string[]} */
function aliasesOf(e) {
  const list = (e.aliases && e.aliases.en) || [];
  return list.map((a) => a.value).filter(Boolean).slice(0, 8);
}

module.exports = {resolvePerson, isHuman, HUMAN, INSTANCE_OF};
