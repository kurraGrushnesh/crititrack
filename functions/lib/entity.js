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

const logger = require("./logger");
const {fetchWithTimeout} = require("./httpUtil");

const API = "https://www.wikidata.org/w/api.php";
// Wikimedia asks for a contact URL that actually resolves. This pointed
// at crititrack.app, which is not a registered domain.
const UA = "CritiTrack/1.0 (https://crititrack-f7430.web.app)";

/** Wikidata item id for "human". */
const HUMAN = "Q5";

/** "instance of" property. */
const INSTANCE_OF = "P31";

/**
 * Structured properties worth reading off the entity.
 *
 * These are facts, not generation. The profile's prose summary comes from
 * a model and is labelled as such; a birth date does not need a model and
 * must not come from one, because a model will produce a plausible date
 * for someone it knows nothing about and there is no way to tell the two
 * apart on screen.
 */
const PROPS = {
  birthDate: "P569",
  deathDate: "P570",
  citizenship: "P27",
  occupation: "P106",
  // A typical public figure carries ~250 properties and this read only
  // five of them, so the profile was a stub while the record sat there
  // sourced. These are the ones that describe a career rather than a
  // demographic: what they are known for, what they won, where they
  // trained, where they are from.
  award: "P166",
  notableWork: "P800",
  education: "P69",
  birthPlace: "P19",
  // "field of work" — the domain(s) a person is professionally known
  // for, e.g. "artificial intelligence", "human rights". Sourced, so it
  // is a real basis for a profile's "expertise" line rather than a
  // model's guess. Comes in the same wbgetentities call, no extra fetch.
  fieldOfWork: "P101",
};

/**
 * Point-in-time qualifier, used to date an award.
 *
 * An award without a year is a claim; an award with one is an event, and
 * events can be put on a timeline and lined up against coverage.
 */
const POINT_IN_TIME = "P585";

/**
 * External identifiers, which are string-valued rather than entity-valued.
 *
 * These exist so a reader can leave and check for themselves. For a tool
 * whose argument is "here is the evidence", linking to the primary
 * account and to IMDb is part of the argument, not a convenience.
 */
const EXTERNAL = {
  imdb: "P345",
  x: "P2002",
  instagram: "P2003",
  website: "P856",
  youtube: "P2397", // channel id, "UC..."
  facebook: "P2013", // page/profile id or vanity name
  tiktok: "P7085", // handle without the "@"
  linkedin: "P6634", // personal profile vanity id
  threads: "P17427", // handle without the "@"
  bluesky: "P12361", // full handle, e.g. "name.bsky.social"
  mastodon: "P4033", // "user@instance.tld"
};

/** How many occupations to keep. Wikidata often lists a dozen. */
const MAX_OCCUPATIONS = 4;
const MAX_AWARDS = 12;
const MAX_WORKS = 8;
const MAX_EDUCATION = 3;

/** How many search hits to inspect. The person is rarely the top hit —
 * a search for "Zendaya" returns the given name first, then the album,
 * with the actress second — so a naive first-result pick resolves the
 * wrong entity. */
const CANDIDATES = 5;

/**
 * Resolves a free-text name to a single human on Wikidata.
 *
 * Returns the best human match, along with every other human the search
 * turned up. The alternatives matter: "Michael Jordan" is a basketball
 * player, a footballer and a professor of computer science, and silently
 * picking the most-linked one is a guess presented as a fact. The caller
 * shows what was chosen and offers the rest.
 *
 * @param {string} name a validated name from lib/validate.js
 * @return {Promise<object|null>} null when nothing suitable was found
 */
async function resolvePerson(name) {
  try {
    const hits = await search(name);
    if (hits.length === 0) return null;

    const entities = await describe(hits.map((h) => h.id));

    // Search results are ordered by relevance, so the first hit that is
    // actually a human is the best human match.
    const humans = hits
        .map((hit) => ({hit, entity: entities[hit.id]}))
        .filter(({entity}) => entity && isHuman(entity));

    if (humans.length === 0) return null;

    const [best, ...rest] = humans;
    return {
      ...(await toPerson(best.hit, best.entity, name)),
      candidates: rest.map(({hit, entity}) => ({
        qid: hit.id,
        label: labelOf(entity) || hit.label || "",
        description: descriptionOf(entity) || hit.description || "",
      })),
    };
  } catch (e) {
    logger.warn(`entity resolution failed for "${name}": ${e.message}`);
    return null;
  }
}

/**
 * Resolves a specific Wikidata id, bypassing search entirely.
 *
 * Used when the reader picks one of the alternatives offered above. Going
 * back through search with the chosen label would be circular — two people
 * can share a label exactly, which is how the ambiguity arose.
 *
 * @param {string} qid
 * @return {Promise<object|null>}
 */
async function resolveByQid(qid) {
  if (!/^Q\d+$/.test(String(qid || ""))) return null;

  try {
    const entities = await describe([qid]);
    const entity = entities[qid];
    if (!entity || !isHuman(entity)) return null;

    return {
      ...(await toPerson({id: qid, label: "", description: ""}, entity, qid)),
      candidates: [],
    };
  } catch (e) {
    logger.warn(`entity lookup failed for ${qid}: ${e.message}`);
    return null;
  }
}

/**
 * @param {{id: string, label: string, description: string}} hit
 * @param {object} entity
 * @param {string} fallbackLabel
 * @return {Promise<object>}
 */
async function toPerson(hit, entity, fallbackLabel) {
  return {
    qid: hit.id,
    label: labelOf(entity) || hit.label || fallbackLabel,
    description: descriptionOf(entity) || hit.description || "",
    aliases: aliasesOf(entity),
    facts: await resolveFactLabels(extractFacts(entity)),
  };
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

module.exports = {
  resolvePerson,
  resolveByQid,
  extractFacts,
  isHuman,
  HUMAN,
  INSTANCE_OF,
  PROPS,
  EXTERNAL,
  MAX_OCCUPATIONS,
  MAX_AWARDS,
  MAX_WORKS,
};

/**
 * Reads the structured claims off an entity.
 *
 * Pure: it does no network work, so the shape of every Wikidata claim
 * this depends on is pinned by fixture tests rather than by hoping the
 * live API keeps its schema.
 *
 * @param {object} entity
 * @return {{
 *   birthDate: string|null, deathDate: string|null,
 *   citizenshipIds: string[], occupationIds: string[]
 * }}
 */
function extractFacts(entity) {
  return {
    birthDate: timeClaim(entity, PROPS.birthDate),
    deathDate: timeClaim(entity, PROPS.deathDate),
    citizenshipIds: idClaims(entity, PROPS.citizenship).slice(0, 2),
    occupationIds: idClaims(entity, PROPS.occupation).slice(0, MAX_OCCUPATIONS),
    // Awards keep their year so they can be ordered and placed on a
    // timeline. Undated ones are kept — the award still happened — and
    // sort last, the same rule the controversy list already uses.
    awards: datedIdClaims(entity, PROPS.award).slice(0, MAX_AWARDS),
    notableWorkIds: idClaims(entity, PROPS.notableWork).slice(0, MAX_WORKS),
    educationIds: idClaims(entity, PROPS.education).slice(0, MAX_EDUCATION),
    birthPlaceId: idClaims(entity, PROPS.birthPlace)[0] || null,
    fieldOfWorkIds: idClaims(entity, PROPS.fieldOfWork).slice(0, 6),
    links: externalLinks(entity),
  };
}

/**
 * Entity-valued claims paired with their point-in-time qualifier.
 *
 * @param {object} entity
 * @param {string} prop
 * @return {Array<{id: string, year: number|null}>}
 */
function datedIdClaims(entity, prop) {
  const claims = (entity && entity.claims && entity.claims[prop]) || [];

  return claims
      .filter((c) => !isDeprecated(c))
      .map((c) => {
        const id = c && c.mainsnak && c.mainsnak.datavalue &&
          c.mainsnak.datavalue.value && c.mainsnak.datavalue.value.id;
        return {id, year: qualifierYear(c, POINT_IN_TIME)};
      })
      .filter((a) => typeof a.id === "string" && /^Q\d+$/.test(a.id));
}

/**
 * The year of a time-valued qualifier, when one is present.
 *
 * @param {object} claim
 * @param {string} prop
 * @return {number|null}
 */
function qualifierYear(claim, prop) {
  const quals = (claim && claim.qualifiers && claim.qualifiers[prop]) || [];
  for (const q of quals) {
    const t = q && q.datavalue && q.datavalue.value &&
      q.datavalue.value.time;
    if (typeof t !== "string" || !t.startsWith("+")) continue;
    const m = t.match(/^\+(\d{4,})-/);
    if (m) return Number(m[1]);
  }
  return null;
}

/**
 * String-valued external identifiers, turned into URLs.
 *
 * Only the handle is stored on Wikidata; the URL shape is ours. Any
 * identifier that is absent is simply omitted rather than rendered as a
 * dead link.
 *
 * @param {object} entity
 * @return {Record<string, string>}
 */
function externalLinks(entity) {
  const out = {};
  const raw = (prop) => {
    const claims = (entity && entity.claims && entity.claims[prop]) || [];
    for (const c of claims) {
      if (isDeprecated(c)) continue;
      const v = c && c.mainsnak && c.mainsnak.datavalue &&
        c.mainsnak.datavalue.value;
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };

  const imdb = raw(EXTERNAL.imdb);
  // Only name ids belong on a person; a title id here would be a data
  // error on the entity and would link to a film.
  if (imdb && /^nm\d+$/.test(imdb)) {
    out.imdb = `https://www.imdb.com/name/${imdb}/`;
  }

  const x = raw(EXTERNAL.x);
  if (x && /^[A-Za-z0-9_]{1,15}$/.test(x)) out.x = `https://x.com/${x}`;

  const ig = raw(EXTERNAL.instagram);
  if (ig && /^[A-Za-z0-9._]{1,30}$/.test(ig)) {
    out.instagram = `https://www.instagram.com/${ig}/`;
  }

  const yt = raw(EXTERNAL.youtube);
  if (yt && /^UC[A-Za-z0-9_-]{22}$/.test(yt)) {
    out.youtube = `https://www.youtube.com/channel/${yt}`;
  }

  const fb = raw(EXTERNAL.facebook);
  if (fb && /^[A-Za-z0-9.]{2,60}$/.test(fb)) {
    out.facebook = `https://www.facebook.com/${fb}`;
  }

  const tt = raw(EXTERNAL.tiktok);
  if (tt && /^[A-Za-z0-9._]{2,24}$/.test(tt)) {
    out.tiktok = `https://www.tiktok.com/@${tt}`;
  }

  const li = raw(EXTERNAL.linkedin);
  if (li && /^[A-Za-z0-9-]{3,100}$/.test(li)) {
    out.linkedin = `https://www.linkedin.com/in/${li}`;
  }

  const th = raw(EXTERNAL.threads);
  if (th && /^[A-Za-z0-9._]{1,30}$/.test(th)) {
    out.threads = `https://www.threads.net/@${th}`;
  }

  const bsky = raw(EXTERNAL.bluesky);
  if (bsky && /^[A-Za-z0-9.-]{3,253}$/.test(bsky) && bsky.includes(".")) {
    out.bluesky = `https://bsky.app/profile/${bsky}`;
  }

  const masto = raw(EXTERNAL.mastodon);
  const mm = masto && masto.match(/^([A-Za-z0-9_]{1,30})@([A-Za-z0-9.-]{3,253})$/);
  if (mm) out.mastodon = `https://${mm[2]}/@${mm[1]}`;

  const site = raw(EXTERNAL.website);
  if (site && /^https?:\/\//i.test(site)) out.website = site;

  return out;
}

/**
 * Turns the qids in a fact bundle into English labels.
 *
 * One extra round trip for every occupation and citizenship at once. If
 * it fails the facts are returned with empty label lists rather than raw
 * qids: "Q30" on a profile is worse than no line at all.
 *
 * @param {object} facts from extractFacts
 * @return {Promise<object>}
 */
async function resolveFactLabels(facts) {
  const ids = [
    ...facts.citizenshipIds,
    ...facts.occupationIds,
    ...facts.awards.map((a) => a.id),
    ...facts.notableWorkIds,
    ...facts.educationIds,
    ...(facts.birthPlaceId ? [facts.birthPlaceId] : []),
    ...(facts.fieldOfWorkIds || []),
  ];

  let labels = {};
  if (ids.length > 0) {
    try {
      const entities = await describeLabels(ids);
      for (const id of ids) {
        const label = entities[id] ? labelOf(entities[id]) : "";
        if (label) labels[id] = label;
      }
    } catch (e) {
      logger.warn(`fact label lookup failed: ${e.message}`);
      labels = {};
    }
  }

  return {
    birthDate: facts.birthDate,
    deathDate: facts.deathDate,
    citizenship: facts.citizenshipIds.map((id) => labels[id]).filter(Boolean),
    occupations: facts.occupationIds.map((id) => labels[id]).filter(Boolean),
    // Dated first, newest first; undated last. Same ordering rule the
    // controversy list uses, so the two read consistently.
    awards: facts.awards
        .map((a) => ({label: labels[a.id] || "", year: a.year}))
        .filter((a) => a.label)
        .sort((a, b) => (b.year || -Infinity) - (a.year || -Infinity)),
    notableWorks: facts.notableWorkIds
        .map((id) => labels[id])
        .filter(Boolean),
    education: facts.educationIds.map((id) => labels[id]).filter(Boolean),
    birthPlace: (facts.birthPlaceId && labels[facts.birthPlaceId]) || null,
    fieldsOfWork: (facts.fieldOfWorkIds || [])
        .map((id) => labels[id])
        .filter(Boolean),
    links: facts.links,
  };
}

/**
 * A time-valued claim, reduced to as much of an ISO date as Wikidata
 * actually asserts.
 *
 * Wikidata stores a precision alongside every date. Precision 9 means the
 * year is known and the month and day are padded zeroes; rendering
 * "+1856-00-00T00:00:00Z" as 1 January would invent a birthday. Anything
 * less precise than a year is dropped.
 *
 * @param {object} entity
 * @param {string} prop
 * @return {string|null} "YYYY", "YYYY-MM" or "YYYY-MM-DD"
 */
function timeClaim(entity, prop) {
  const claims = (entity && entity.claims && entity.claims[prop]) || [];

  for (const c of claims) {
    const v = c && c.mainsnak && c.mainsnak.datavalue &&
      c.mainsnak.datavalue.value;
    if (!v || typeof v.time !== "string") continue;

    // Leading sign: "+" for CE, "-" for BCE. A BCE birth date is not a
    // living public figure, so those are dropped rather than rendered.
    if (!v.time.startsWith("+")) continue;

    const m = v.time.match(/^\+(\d{4,})-(\d{2})-(\d{2})T/);
    if (!m) continue;

    const precision = typeof v.precision === "number" ? v.precision : 11;
    const [, year, month, day] = m;

    if (precision >= 11 && month !== "00" && day !== "00") {
      return `${year}-${month}-${day}`;
    }
    if (precision >= 10 && month !== "00") return `${year}-${month}`;
    if (precision >= 9) return year;
  }

  return null;
}

/**
 * The item ids of an entity-valued claim, best first.
 *
 * @param {object} entity
 * @param {string} prop
 * @return {string[]}
 */
function idClaims(entity, prop) {
  const claims = (entity && entity.claims && entity.claims[prop]) || [];

  return claims
      .filter((c) => !isDeprecated(c))
      .map(
          (c) =>
            c && c.mainsnak && c.mainsnak.datavalue &&
        c.mainsnak.datavalue.value && c.mainsnak.datavalue.value.id,
      )
      .filter((id) => typeof id === "string" && /^Q\d+$/.test(id));
}

/** @param {object} claim @return {boolean} */
function isDeprecated(claim) {
  return Boolean(claim) && claim.rank === "deprecated";
}

/**
 * Labels only, for turning qids into words.
 *
 * @param {string[]} ids
 * @return {Promise<Record<string, object>>}
 */
async function describeLabels(ids) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};

  const u = new URL(API);
  u.searchParams.set("action", "wbgetentities");
  u.searchParams.set("ids", unique.join("|"));
  u.searchParams.set("props", "labels");
  u.searchParams.set("languages", "en");
  u.searchParams.set("format", "json");

  const res = await fetchWithTimeout(u, {headers: {"User-Agent": UA}}, 8000);
  if (!res.ok) return {};

  const j = await res.json();
  return j.entities || {};
}
