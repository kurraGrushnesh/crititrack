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
  // Career spine. "position held" (P39) names a titled role; "employer"
  // (P108) names an organisation. Both carry P580/P582 start/end
  // qualifiers, and a P39 claim names its organisation with a P642 "of"
  // or P108 "employer" qualifier. Every entry is Wikidata-sourced and
  // dated — the basis for a real career timeline rather than a guess.
  positionHeld: "P39",
  employer: "P108",
};

/**
 * Structured Wikidata relationship properties (Step 22 — Entity
 * Relationship Intelligence). Each is a claim that names another entity
 * the subject is documented as connected to, with a controlled
 * relationship type and a direction relative to the subject. These come
 * in the same `wbgetentities` call as everything above — no extra
 * fetch. Career relationships (employer/position) are NOT here: they
 * are already derived from `career` on the client.
 *
 * `direction` is from the subject (this profile) toward the target:
 *   OUTGOING       — subject → target (e.g. "member of", "owns")
 *   INCOMING       — target → subject (e.g. target "is parent of" subject)
 *   BIDIRECTIONAL  — symmetric (spouse, sibling)
 */
const RELATIONSHIP_PROPS = {
  P26: {type: "SPOUSE", category: "PERSONAL", direction: "BIDIRECTIONAL"},
  P451: {type: "FAMILY", category: "PERSONAL", direction: "BIDIRECTIONAL"},
  P22: {type: "PARENT", category: "PERSONAL", direction: "INCOMING"},
  P25: {type: "PARENT", category: "PERSONAL", direction: "INCOMING"},
  P40: {type: "CHILD", category: "PERSONAL", direction: "OUTGOING"},
  P3373: {type: "SIBLING", category: "PERSONAL", direction: "BIDIRECTIONAL"},
  P1038: {type: "FAMILY", category: "PERSONAL", direction: "UNKNOWN"},
  P463: {type: "MEMBER_OF", category: "ORGANIZATIONAL", direction: "OUTGOING"},
  P1830: {type: "OWNS", category: "BUSINESS", direction: "OUTGOING"},
};

/** How many structured relationships to keep per property. A public
 * figure with 40 "member of" claims is real but past this it is noise
 * on a profile. */
const MAX_RELATIONSHIPS_PER_PROP = 8;

/** Qualifier: start date of a dated claim. */
const START_TIME = "P580";
/** Qualifier: end date of a dated claim. */
const END_TIME = "P582";
/** Qualifier: "of" — links a position to its organisation. */
const OF = "P642";
/** Qualifier: "object has role" / "as" — a role within an employment. */
const AS_ROLE = "P794";
/** Qualifier: "location" — where a post was held, when recorded. */
const LOCATION = "P276";

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
/** How many career rows to keep. Enough for a full arc, not a résumé. */
const MAX_CAREER = 14;

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

    // Compact card data for every alternative, resolved in one round trip.
    const candidates = await buildCandidates(rest);
    const confidence = resolutionConfidence(name, best, humans);

    return {
      ...(await toPerson(best.hit, best.entity, name)),
      sitelinks: sitelinkCount(best.entity),
      confidence,
      candidates,
    };
  } catch (e) {
    logger.warn(`entity resolution failed for "${name}": ${e.message}`);
    return null;
  }
}

/** Sitelink count = number of Wikipedia language editions with an article. */
function sitelinkCount(entity) {
  return entity && entity.sitelinks ?
    Object.keys(entity.sitelinks).length :
    0;
}

/** First entity-id value of a claim, or null. */
function firstClaimId(entity, prop) {
  return idClaims(entity, prop)[0] || null;
}

/** Commons portrait URL from a P18 image claim, or null. */
function portraitUrl(entity) {
  const claims = ((entity && entity.claims && entity.claims.P18) || [])
      .filter((c) => !isDeprecated(c));
  for (const c of claims) {
    const v = c && c.mainsnak && c.mainsnak.datavalue &&
      c.mainsnak.datavalue.value;
    if (typeof v === "string" && v.trim()) {
      const file = encodeURIComponent(v.trim().replace(/ /g, "_"));
      return `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=160`;
    }
  }
  return null;
}

/** A short "YYYY" birth year for a disambiguation card, or null. */
function birthYear(entity) {
  const t = timeClaim(entity, PROPS.birthDate);
  return t ? t.slice(0, 4) : null;
}

/**
 * Turns the runner-up human hits into compact disambiguation cards:
 * name, description, occupation, country, portrait, birth year, qid,
 * prominence. One extra label lookup resolves every occupation and
 * citizenship id at once.
 *
 * @param {Array<{hit: object, entity: object}>} rest
 * @return {Promise<Array<object>>}
 */
async function buildCandidates(rest) {
  const idsToLabel = new Set();
  const partial = rest.map(({hit, entity}) => {
    const occId = firstClaimId(entity, PROPS.occupation);
    const cityId = firstClaimId(entity, PROPS.citizenship);
    if (occId) idsToLabel.add(occId);
    if (cityId) idsToLabel.add(cityId);
    return {
      qid: hit.id,
      label: labelOf(entity) || hit.label || "",
      description: descriptionOf(entity) || hit.description || "",
      occId,
      cityId,
      image: portraitUrl(entity),
      birthYear: birthYear(entity),
      sitelinks: sitelinkCount(entity),
    };
  });

  let labels = {};
  if (idsToLabel.size > 0) {
    try {
      const ents = await describeLabels([...idsToLabel]);
      for (const id of idsToLabel) {
        const l = ents[id] ? labelOf(ents[id]) : "";
        if (l) labels[id] = l;
      }
    } catch (e) {
      logger.warn(`candidate label lookup failed: ${e.message}`);
      labels = {};
    }
  }

  return partial.map((c) => ({
    qid: c.qid,
    label: c.label,
    description: c.description,
    occupation: (c.occId && labels[c.occId]) || null,
    country: (c.cityId && labels[c.cityId]) || null,
    image: c.image,
    birthYear: c.birthYear,
    prominence: c.sitelinks,
  }));
}

/**
 * How sure we are that `best` is the person the searcher meant.
 *
 *   high      — the query names exactly one well-documented person, and
 *               no other candidate both matches the name and is notable.
 *   medium    — one clear best match, but a lesser same-named person
 *               exists, or the name is not an exact match.
 *   low       — the top match is thinly documented, or the query did not
 *               cleanly match any candidate's name.
 *   ambiguous — two or more candidates match the name and are each
 *               notable ("Michael Jordan").
 *
 * Names being similar, or a shared profession/country, are never enough
 * on their own — the check is name-match plus independent notability
 * (sitelink count), not name similarity.
 *
 * @param {string} query
 * @param {{hit: object, entity: object}} best
 * @param {Array<{hit: object, entity: object}>} humans all human hits
 * @return {"high"|"medium"|"low"|"ambiguous"}
 */
function resolutionConfidence(query, best, humans) {
  const q = normName(query);
  const named = (e, hit) =>
    normName(labelOf(e) || (hit && hit.label)) === q ||
    aliasesOf(e).some((a) => normName(a) === q);

  const bestNamed = named(best.entity, best.hit);
  const bestLinks = sitelinkCount(best.entity);

  // Other people whose name — not just profession or country — also
  // answers the query, ranked by how independently documented they are.
  const namesakes = humans
      .slice(1)
      .filter(({hit, entity}) => named(entity, hit))
      .map(({entity}) => sitelinkCount(entity));

  if (!bestNamed) {
    // The query did not match the chosen label. A lone, well-documented
    // result is a loose match (low); anything else is genuinely unclear.
    return humans.length === 1 && bestLinks >= 5 ? "low" : "ambiguous";
  }
  // A second person who both shares the name and is notable in their own
  // right — this is the "Michael Jordan" case, and we must not pick.
  if (namesakes.some((n) => n >= 5)) return "ambiguous";
  if (bestLinks < 3) return "low";
  // A minor namesake exists: the best match is still clear, but flag it.
  if (namesakes.length > 0) return "medium";
  return "high";
}

/** Normalised name for equality checks: lowercased, punctuation stripped. */
function normName(s) {
  return String(s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[.'’-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
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
      sitelinks: sitelinkCount(entity),
      // The caller picked this exact record, so resolution is settled.
      confidence: "high",
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
    facts: await resolveFactLabels(extractFacts(entity), hit.id),
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
  // sitelinks: the number of Wikipedia language editions is a strong,
  // source-backed prominence signal used to score resolution confidence
  // and to tell two same-named people apart.
  u.searchParams.set("props", "claims|labels|descriptions|aliases|sitelinks");
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
  resolutionConfidence,
  sitelinkCount,
  extractFacts,
  careerEntries,
  relationshipClaims,
  RELATIONSHIP_PROPS,
  buildCareer,
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
    career: careerEntries(entity),
    relationships: relationshipClaims(entity),
    links: externalLinks(entity),
  };
}

/**
 * Structured relationship rows from the properties in
 * {@link RELATIONSHIP_PROPS}. Pure and label-free — returns qids and
 * years; {@link resolveFactLabels} turns the target qids into words.
 *
 * A relationship is only emitted when its target is an item id: a
 * dangling or novalue snak is dropped, never guessed at. Deprecated
 * claims are excluded (Wikidata's own "this was wrong" marker).
 *
 * @param {object} entity
 * @return {Array<{type: string, category: string, direction: string,
 *   targetId: string, start: number|null, end: number|null}>}
 */
function relationshipClaims(entity) {
  const claims = (entity && entity.claims) || {};
  const out = [];
  for (const [prop, meta] of Object.entries(RELATIONSHIP_PROPS)) {
    const rows = (claims[prop] || []).filter((c) => !isDeprecated(c));
    for (const c of rows.slice(0, MAX_RELATIONSHIPS_PER_PROP)) {
      const targetId = mainId(c);
      if (!targetId) continue;
      out.push({
        type: meta.type,
        category: meta.category,
        direction: meta.direction,
        targetId,
        start: qualifierYear(c, START_TIME),
        end: qualifierYear(c, END_TIME),
      });
    }
  }
  return out;
}

/** First entity-id value of a claim qualifier, or null. */
function qualifierId(claim, prop) {
  const quals = (claim && claim.qualifiers && claim.qualifiers[prop]) || [];
  for (const q of quals) {
    const id = q && q.datavalue && q.datavalue.value && q.datavalue.value.id;
    if (typeof id === "string" && /^Q\d+$/.test(id)) return id;
  }
  return null;
}

/** The id a claim's main snak points at, when it is an item id. */
function mainId(claim) {
  const id = claim && claim.mainsnak && claim.mainsnak.datavalue &&
    claim.mainsnak.datavalue.value && claim.mainsnak.datavalue.value.id;
  return typeof id === "string" && /^Q\d+$/.test(id) ? id : null;
}

/**
 * Career rows from P39 "position held" and P108 "employer".
 *
 * Pure and label-free — it returns qids and years; resolveFactLabels
 * turns them into words. A P108 employment that duplicates a P39 post
 * over the same organisation and start year is dropped, so "CEO of X"
 * and "employed by X" do not both appear for one period.
 *
 * @param {object} entity
 * @return {Array<{roleId: string|null, orgId: string|null,
 *   start: number|null, end: number|null}>}
 */
function careerEntries(entity) {
  const claims = (entity && entity.claims) || {};
  const rows = [];

  for (const c of claims[PROPS.positionHeld] || []) {
    if (isDeprecated(c)) continue;
    const roleId = mainId(c);
    if (!roleId) continue;
    rows.push({
      roleId,
      orgId: qualifierId(c, PROPS.employer) || qualifierId(c, OF),
      locationId: qualifierId(c, LOCATION),
      start: qualifierYear(c, START_TIME),
      end: qualifierYear(c, END_TIME),
      _src: "position",
    });
  }

  for (const c of claims[PROPS.employer] || []) {
    if (isDeprecated(c)) continue;
    const orgId = mainId(c);
    if (!orgId) continue;
    const start = qualifierYear(c, START_TIME);
    const covered = rows.some(
        (r) => r.orgId === orgId && r.start === start && r._src === "position",
    );
    if (covered) continue;
    rows.push({
      roleId: qualifierId(c, AS_ROLE),
      orgId,
      locationId: null,
      start,
      end: qualifierYear(c, END_TIME),
      _src: "employer",
    });
  }

  // A row needs a date or a role to earn a place on the timeline; a bare
  // undated employer with no title is not something to show.
  return rows
      .filter((r) => r.start != null || r.end != null || r.roleId)
      .map(({roleId, orgId, locationId, start, end}) => ({
        roleId, orgId, locationId, start, end,
      }))
      .slice(0, MAX_CAREER * 2);
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
async function resolveFactLabels(facts, qid) {
  const careerIds = (facts.career || []).flatMap(
      (e) => [e.roleId, e.orgId, e.locationId].filter(Boolean),
  );
  const relationshipIds = (facts.relationships || []).map((r) => r.targetId);
  const ids = [
    ...facts.citizenshipIds,
    ...facts.occupationIds,
    ...facts.awards.map((a) => a.id),
    ...facts.notableWorkIds,
    ...facts.educationIds,
    ...(facts.birthPlaceId ? [facts.birthPlaceId] : []),
    ...(facts.fieldOfWorkIds || []),
    ...careerIds,
    ...relationshipIds,
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
    career: buildCareer(facts.career || [], labels, qid),
    organizations: majorOrganizations(facts.career || [], labels),
    // Structured relationships, target qids resolved to names. A row
    // whose target has no resolvable label is dropped — a relationship
    // to "Q30" is worse than no line at all, same rule as every other
    // fact list here. `sourceUrl` points at the subject's own Wikidata
    // page, which is where the claim is recorded.
    relationships: (facts.relationships || [])
        .map((r) => ({
          type: r.type,
          category: r.category,
          direction: r.direction,
          targetId: r.targetId,
          targetLabel: labels[r.targetId] || "",
          start: r.start,
          end: r.end,
          sourceUrl: qid ? `https://www.wikidata.org/wiki/${qid}` : null,
        }))
        .filter((r) => r.targetLabel),
    links: facts.links,
  };
}

/**
 * Resolves career rows to labels, drops the un-nameable, dedupes, and
 * orders them oldest-first so they read as a progression. Every row keeps
 * a Wikidata source link because that is where the fact came from.
 *
 * @param {Array<object>} rows from careerEntries
 * @param {Record<string, string>} labels
 * @param {string} qid the person's Wikidata id, for provenance
 * @return {Array<object>}
 */
function buildCareer(rows, labels, qid) {
  const source = /^Q\d+$/.test(String(qid || "")) ?
    {name: "Wikidata", url: `https://www.wikidata.org/wiki/${qid}`} :
    {name: "Wikidata", url: null};

  const seen = new Set();
  return rows
      .map((r) => ({
        role: (r.roleId && labels[r.roleId]) || null,
        organization: (r.orgId && labels[r.orgId]) || null,
        location: (r.locationId && labels[r.locationId]) || null,
        start: r.start,
        end: r.end,
      }))
      .filter((r) => r.role || r.organization)
      .filter((r) => {
        const k = `${r.role}|${r.organization}|${r.start}|${r.end}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => {
        // Oldest first; an undated row sorts after every dated one.
        const sa = a.start ?? a.end ?? Infinity;
        const sb = b.start ?? b.end ?? Infinity;
        return sa - sb;
      })
      .slice(0, MAX_CAREER)
      .map((r) => ({...r, source}));
}

/**
 * The organisations a career touched, most-recent first, de-duplicated.
 * Used for the "major organisations" chips in the professional summary.
 *
 * @param {Array<object>} rows from careerEntries
 * @param {Record<string, string>} labels
 * @return {string[]}
 */
function majorOrganizations(rows, labels) {
  const byOrg = new Map();
  for (const r of rows) {
    const name = r.orgId && labels[r.orgId];
    if (!name) continue;
    const when = r.end ?? r.start ?? 0;
    if (!byOrg.has(name) || when > byOrg.get(name)) byOrg.set(name, when);
  }
  return [...byOrg.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .slice(0, 6);
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
