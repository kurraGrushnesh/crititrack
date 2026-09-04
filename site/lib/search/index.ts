/**
 * Universal discovery search over the two datasets CritiTrack actually
 * has: the 251-figure catalogue (real people, facts only) and the Step 1
 * professional taxonomy (sectors → industries → occupations →
 * specialisations, with ~1,400 aliases).
 *
 * No company / organisation / sports-team data exists, so those groups
 * are always empty and the UI says so rather than inventing rows.
 *
 * Everything is computed from data already bundled (a few hundred KB) —
 * no database load, no network. The index is built once and memoised.
 */

import {
  ROSTER,
  catalogueProfession,
  categoryBySlug,
  figureSlug,
  CATEGORIES,
  rosterFor,
  type RosterEntry,
} from "../catalog";
import {
  OCCUPATIONS,
  SPECIALIZATIONS,
  INDUSTRIES,
  SECTORS,
  getOccupation,
  occupationPath,
  resolveOccupation,
  resolveIndustry,
  normalizeLabel,
  type Occupation,
  type Industry,
  type Sector,
} from "../taxonomy";
import { countryForDemonym, countryFromDescriptor } from "./demonyms";

// ── Types ──────────────────────────────────────────────────────────

export interface PersonHit {
  kind: "person";
  slug: string;
  name: string;
  descriptor: string;
  category: string;
  born: number;
  profession: { label: string; sector: string; industry: string } | null;
  country: string | null;
  score: number;
}

export interface TaxonomyHit {
  kind: "occupation" | "specialization" | "industry" | "sector" | "category";
  id: string;
  label: string;
  path: string | null;
  count: number;
  score: number;
}

export interface SearchFilters {
  sectorId?: string;
  industryId?: string;
  occupationId?: string;
  country?: string;
  category?: string;
  bornDecade?: number;
}

export interface SearchResult {
  query: string;
  interpretation: string[];
  people: PersonHit[];
  professions: TaxonomyHit[];
  categories: TaxonomyHit[];
  organizations: never[];
  filters: SearchFilters;
}

export interface Suggestion {
  kind: "person" | "occupation" | "industry" | "sector" | "category" | "lookup";
  label: string;
  sublabel?: string;
  href: string;
}

// ── Index ──────────────────────────────────────────────────────────

interface IndexedPerson {
  entry: RosterEntry;
  slug: string;
  normName: string;
  nameTokens: string[];
  profession: { label: string; sector: string; industry: string } | null;
  occupationId: string | null;
  familyId: string | null;
  sectorId: string | null;
  industryId: string | null;
  country: string | null;
}

let cache: {
  people: IndexedPerson[];
  occCount: Map<string, number>;
  sectorCount: Map<string, number>;
  industryCount: Map<string, number>;
} | null = null;

function index() {
  if (cache) return cache;

  const occCount = new Map<string, number>();
  const sectorCount = new Map<string, number>();
  const industryCount = new Map<string, number>();

  const people: IndexedPerson[] = ROSTER.map((entry) => {
    const prof = catalogueProfession(entry);
    let occId: string | null = null;
    let famId: string | null = null;
    let secId: string | null = null;
    let indId: string | null = null;
    if (prof) {
      const resolved =
        resolveOccupation(entry.descriptor) ??
        // fall back to the same resolver catalogueProfession used
        (() => {
          const rc = catalogueProfession(entry);
          const o = OCCUPATIONS.find((x) => x.label === rc?.label);
          return o ? { occupation: o } : null;
        })();
      occId = resolved?.occupation.id ?? null;
      const occ = occId ? getOccupation(occId) : null;
      const path = occ ? occupationPath(occ.id) : null;
      famId = occ?.familyId ?? null;
      secId = path?.sectorId ?? null;
      indId = path?.industryId ?? null;
      if (occId) occCount.set(occId, (occCount.get(occId) ?? 0) + 1);
      if (secId) sectorCount.set(secId, (sectorCount.get(secId) ?? 0) + 1);
      if (indId) industryCount.set(indId, (industryCount.get(indId) ?? 0) + 1);
    }
    return {
      entry,
      slug: figureSlug(entry.name),
      normName: normalizeLabel(entry.name),
      nameTokens: normalizeLabel(entry.name).split(" ").filter(Boolean),
      profession: prof,
      occupationId: occId,
      familyId: famId,
      sectorId: secId,
      industryId: indId,
      country: entry.country ?? countryFromDescriptor(entry.descriptor),
    };
  });

  cache = { people, occCount, sectorCount, industryCount };
  return cache;
}

// ── Small string helpers ───────────────────────────────────────────

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "and", "or", "to", "for",
  "with", "people", "person", "who", "are", "is", "list", "all", "top",
  "best", "famous", "known",
]);

/** Rough singular form, plus a few irregulars that matter for search. */
export function singularize(word: string): string {
  const w = word.toLowerCase();
  const irregular: Record<string, string> = {
    ceos: "ceo",
    women: "woman",
    men: "man",
    people: "person",
    athletes: "athlete",
    actresses: "actress",
  };
  if (irregular[w]) return irregular[w];
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith("ses") || w.endsWith("xes") || w.endsWith("ches")) {
    return w.slice(0, -2);
  }
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  return w;
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        last + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      last = tmp;
    }
  }
  return prev[b.length];
}

function fuzzyClose(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 2) return false;
  const d = levenshtein(a, b);
  return Math.min(a.length, b.length) <= 5 ? d <= 1 : d <= 2;
}

// ── Query parsing ──────────────────────────────────────────────────

export interface ParsedQuery {
  raw: string;
  norm: string;
  tokens: string[];
  contentTokens: string[];
  country: string | null;
  occupations: Occupation[];
  industries: Industry[];
  sectors: Sector[];
  legacyCategory: string | null;
  /** Recognised but unsupported dimensions, for an honest note. */
  ignored: string[];
}

function matchSector(text: string): Sector | null {
  const n = normalizeLabel(text);
  for (const s of SECTORS) {
    if (normalizeLabel(s.label) === n) return s;
  }
  return null;
}

export function parseQuery(raw: string): ParsedQuery {
  const norm = normalizeLabel(raw);
  const tokens = norm.split(" ").filter(Boolean);
  const contentTokens = tokens
    .map(singularize)
    .filter((t) => t && !STOPWORDS.has(t));

  const ignored: string[] = [];
  let country: string | null = null;
  const occupations = new Map<string, Occupation>();
  const industries = new Map<string, Industry>();
  const sectors = new Map<string, Sector>();

  // Gender is recognised but not filterable (no gender data on the roster).
  for (const t of tokens) {
    if (["female", "woman", "male", "man"].includes(t)) ignored.push(t);
  }

  // Whole (singularised) phrase first — best chance for "ai researcher",
  // "technology ceo", "association football player".
  const phrase = contentTokens.join(" ");
  const wholeOcc = phrase && resolveOccupation(phrase);
  if (wholeOcc) occupations.set(wholeOcc.occupation.id, wholeOcc.occupation);
  const wholeInd = phrase && resolveIndustry(phrase);
  if (wholeInd) industries.set(wholeInd.id, wholeInd);
  const wholeSec = phrase && matchSector(phrase);
  if (wholeSec) sectors.set(wholeSec.id, wholeSec);

  // Then tokens and adjacent pairs.
  const windows: string[] = [...contentTokens];
  for (let i = 0; i < contentTokens.length - 1; i++) {
    windows.push(`${contentTokens[i]} ${contentTokens[i + 1]}`);
  }
  for (const w of windows) {
    if (!country) country = countryForDemonym(w);
    const o = resolveOccupation(w);
    if (o) occupations.set(o.occupation.id, o.occupation);
    const ind = resolveIndustry(w);
    if (ind) industries.set(ind.id, ind);
    const sec = matchSector(w);
    if (sec) sectors.set(sec.id, sec);
  }

  // Legacy 6-category names ("actors", "musicians"…).
  let legacyCategory: string | null = null;
  for (const c of CATEGORIES) {
    if (contentTokens.includes(singularize(c.label.toLowerCase()))) {
      legacyCategory = c.slug;
    }
  }

  return {
    raw,
    norm,
    tokens,
    contentTokens,
    country,
    occupations: [...occupations.values()],
    industries: [...industries.values()],
    sectors: [...sectors.values()],
    legacyCategory,
    ignored,
  };
}

// ── Name scoring ───────────────────────────────────────────────────

function scoreName(queryNorm: string, queryTokens: string[], p: IndexedPerson): number {
  if (!queryNorm) return 0;
  if (p.normName === queryNorm) return 1000;
  if (p.normName.startsWith(queryNorm)) return 820;
  if (p.normName.includes(queryNorm)) return 620;
  // token prefixes: "ser wil" → "serena williams"
  let tokenScore = 0;
  for (const qt of queryTokens) {
    if (qt.length < 2) continue;
    if (p.nameTokens.some((nt) => nt.startsWith(qt))) tokenScore += 220;
    else if (p.nameTokens.some((nt) => fuzzyClose(nt, qt))) tokenScore += 120;
  }
  if (tokenScore) return Math.min(700, tokenScore);
  if (fuzzyClose(p.normName, queryNorm)) return 300;
  return 0;
}

// ── Search ─────────────────────────────────────────────────────────

const PEOPLE_LIMIT = 30;
const TAXONOMY_LIMIT = 8;

export function search(raw: string, explicit: SearchFilters = {}): SearchResult {
  const { people, occCount, sectorCount, industryCount } = index();
  const parsed = parseQuery(raw);

  const filters: SearchFilters = {
    country: explicit.country ?? parsed.country ?? undefined,
    occupationId: explicit.occupationId ?? parsed.occupations[0]?.id,
    industryId: explicit.industryId ?? parsed.industries[0]?.id,
    sectorId: explicit.sectorId ?? parsed.sectors[0]?.id,
    category: explicit.category ?? parsed.legacyCategory ?? undefined,
    bornDecade: explicit.bornDecade,
  };

  const nameQuery = parsed.norm;
  const nameTokens = parsed.tokens;
  const hasTaxonomyIntent = Boolean(
    filters.occupationId || filters.industryId || filters.sectorId || filters.category,
  );
  const filterFamilyId = filters.occupationId
    ? (getOccupation(filters.occupationId)?.familyId ?? null)
    : null;

  const personHits: PersonHit[] = people
    .map((p): PersonHit | null => {
      const nameScore = scoreName(nameQuery, nameTokens, p);

      let taxScore = 0;
      let taxMatch = !hasTaxonomyIntent && !filters.country && !filters.bornDecade;
      if (filters.occupationId && p.occupationId === filters.occupationId) {
        taxScore += 500;
        taxMatch = true;
      } else if (filterFamilyId && p.familyId === filterFamilyId) {
        // Same occupation family — "YouTubers" also surfaces "Content
        // Creators", both under the online-creation family.
        taxScore += 340;
        taxMatch = true;
      }
      if (filters.industryId && p.industryId === filters.industryId) {
        taxScore += 300;
        taxMatch = true;
      }
      if (filters.sectorId && p.sectorId === filters.sectorId) {
        taxScore += 200;
        taxMatch = true;
      }
      if (filters.category && p.entry.category === filters.category) {
        taxScore += 260;
        taxMatch = true;
      }

      let ok = true;
      if (filters.country) {
        if (p.country !== filters.country) ok = false;
      }
      if (filters.bornDecade != null) {
        if (Math.floor(p.entry.born / 10) * 10 !== filters.bornDecade) ok = false;
      }
      // With a taxonomy/category intent, require the person to match it
      // (unless they are a strong name hit, since a name search wins).
      if (hasTaxonomyIntent && !taxMatch && nameScore < 600) ok = false;

      const score = nameScore + taxScore;
      if (!ok || score <= 0) return null;

      return {
        kind: "person",
        slug: p.slug,
        name: p.entry.name,
        descriptor: p.entry.descriptor,
        category: p.entry.category,
        born: p.entry.born,
        profession: p.profession,
        country: p.country,
        score,
      };
    })
    .filter((h): h is PersonHit => h !== null)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, PEOPLE_LIMIT);

  // Professions (occupations + specialisations) matching the query text.
  const professions = rankTaxonomy(
    parsed,
    [
      ...parsed.occupations.map((o) => ({
        kind: "occupation" as const,
        id: o.id,
        label: o.label,
        path: pathLabel(o.id),
        count: occCount.get(o.id) ?? 0,
        score: 900,
      })),
      ...occupationTextMatches(parsed),
      ...specializationTextMatches(parsed),
    ],
  );

  // Categories = industries + sectors + legacy categories.
  const categories = rankTaxonomy(parsed, [
    ...parsed.industries.map((i) => ({
      kind: "industry" as const,
      id: i.id,
      label: i.label,
      path: SECTORS.find((s) => s.id === i.sectorId)?.label ?? null,
      count: industryCount.get(i.id) ?? 0,
      score: 800,
    })),
    ...parsed.sectors.map((s) => ({
      kind: "sector" as const,
      id: s.id,
      label: s.label,
      path: null,
      count: sectorCount.get(s.id) ?? 0,
      score: 780,
    })),
    ...industryTextMatches(parsed),
    ...(parsed.legacyCategory
      ? [
          {
            kind: "category" as const,
            id: parsed.legacyCategory,
            label: categoryBySlug(parsed.legacyCategory)?.label ?? parsed.legacyCategory,
            path: null,
            count: rosterFor(parsed.legacyCategory).length,
            score: 760,
          },
        ]
      : []),
  ]);

  return {
    query: raw,
    interpretation: describe(parsed, filters, personHits.length),
    people: personHits,
    professions,
    categories,
    organizations: [],
    filters,
  };
}

function pathLabel(occId: string): string | null {
  const p = occupationPath(occId);
  return p ? `${p.sector} · ${p.industry}` : null;
}

function rankTaxonomy(parsed: ParsedQuery, hits: TaxonomyHit[]): TaxonomyHit[] {
  const byId = new Map<string, TaxonomyHit>();
  for (const h of hits) {
    const existing = byId.get(h.kind + h.id);
    if (!existing || h.score > existing.score) byId.set(h.kind + h.id, h);
  }
  return [...byId.values()]
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, TAXONOMY_LIMIT);
}

function occupationTextMatches(parsed: ParsedQuery): TaxonomyHit[] {
  const q = parsed.contentTokens.join(" ");
  if (q.length < 3) return [];
  const { occCount } = index();
  return OCCUPATIONS.filter((o) => {
    const label = normalizeLabel(o.label);
    return (
      label.includes(q) ||
      o.aliases.some((a) => normalizeLabel(a).includes(q)) ||
      fuzzyClose(label, q)
    );
  }).map((o) => ({
    kind: "occupation" as const,
    id: o.id,
    label: o.label,
    path: pathLabel(o.id),
    count: occCount.get(o.id) ?? 0,
    score: normalizeLabel(o.label) === q ? 850 : 500,
  }));
}

function specializationTextMatches(parsed: ParsedQuery): TaxonomyHit[] {
  const q = parsed.contentTokens.join(" ");
  if (q.length < 3) return [];
  return SPECIALIZATIONS.filter((s) => {
    const label = normalizeLabel(s.label);
    return label.includes(q) || fuzzyClose(label, q);
  })
    .slice(0, 6)
    .map((s) => ({
      kind: "specialization" as const,
      id: s.id,
      label: s.label,
      path: (() => {
        const p = occupationPath(s.occupationId);
        return p ? `${p.industry} · ${getOccupation(s.occupationId)?.label ?? ""}` : null;
      })(),
      count: 0,
      score: 450,
    }));
}

function industryTextMatches(parsed: ParsedQuery): TaxonomyHit[] {
  const q = parsed.contentTokens.join(" ");
  if (q.length < 3) return [];
  const { industryCount } = index();
  return INDUSTRIES.filter((i) => {
    const label = normalizeLabel(i.label);
    return label.includes(q) || fuzzyClose(label, q);
  }).map((i) => ({
    kind: "industry" as const,
    id: i.id,
    label: i.label,
    path: SECTORS.find((s) => s.id === i.sectorId)?.label ?? null,
    count: industryCount.get(i.id) ?? 0,
    score: 400,
  }));
}

function describe(parsed: ParsedQuery, filters: SearchFilters, peopleCount: number): string[] {
  const bits: string[] = [];
  if (filters.occupationId) {
    bits.push(`profession: ${getOccupation(filters.occupationId)?.label}`);
  }
  if (filters.industryId) {
    bits.push(`industry: ${INDUSTRIES.find((i) => i.id === filters.industryId)?.label}`);
  }
  if (filters.sectorId && !filters.industryId) {
    bits.push(`sector: ${SECTORS.find((s) => s.id === filters.sectorId)?.label}`);
  }
  if (filters.category) {
    bits.push(`category: ${categoryBySlug(filters.category)?.label}`);
  }
  if (filters.country) bits.push(`country: ${filters.country}`);
  if (filters.bornDecade != null) bits.push(`born: ${filters.bornDecade}s`);
  if (parsed.ignored.length) {
    bits.push(
      `“${parsed.ignored.join(", ")}” noted, but the catalogue has no ${parsed.ignored.includes("female") || parsed.ignored.includes("woman") ? "gender" : "that"} data to filter on`,
    );
  }
  if (bits.length === 0 && peopleCount === 0) {
    bits.push("no matching people, professions or categories in the catalogue");
  }
  return bits;
}

// ── Typeahead ──────────────────────────────────────────────────────

export function suggest(raw: string, limit = 8): Suggestion[] {
  const q = normalizeLabel(raw);
  if (q.length < 2) return [];
  const { people } = index();
  const out: Suggestion[] = [];

  // Always offer the direct live lookup.
  out.push({
    kind: "lookup",
    label: `Search “${raw.trim()}”`,
    sublabel: "look up as a name",
    href: `/figure/?q=${encodeURIComponent(raw.trim())}`,
  });

  const nameTokens = q.split(" ").filter(Boolean);
  const peopleHits = people
    .map((p) => ({ p, s: scoreName(q, nameTokens, p) }))
    .filter((x) => x.s >= 200)
    .sort((a, b) => b.s - a.s)
    .slice(0, 4);
  for (const { p } of peopleHits) {
    out.push({
      kind: "person",
      label: p.entry.name,
      sublabel: p.profession?.label ?? p.entry.descriptor,
      href: `/figure/?q=${encodeURIComponent(p.entry.name)}`,
    });
  }

  const sq = singularize(q.split(" ").pop() ?? q);
  const occHits = OCCUPATIONS.filter(
    (o) =>
      normalizeLabel(o.label).startsWith(q) ||
      normalizeLabel(o.label).startsWith(sq) ||
      o.aliases.some((a) => normalizeLabel(a).startsWith(q)),
  )
    .slice(0, 3)
    .map((o): Suggestion => ({
      kind: "occupation",
      label: o.label,
      sublabel: pathLabel(o.id) ?? "Profession",
      href: `/search/?occupation=${o.id}`,
    }));
  out.push(...occHits);

  const catHits = [
    ...INDUSTRIES.filter((i) => normalizeLabel(i.label).startsWith(q)).map(
      (i): Suggestion => ({
        kind: "industry",
        label: i.label,
        sublabel: "Industry",
        href: `/search/?industry=${i.id}`,
      }),
    ),
    ...SECTORS.filter((s) => normalizeLabel(s.label).startsWith(q)).map(
      (s): Suggestion => ({
        kind: "sector",
        label: s.label,
        sublabel: "Sector",
        href: `/search/?sector=${s.id}`,
      }),
    ),
  ].slice(0, 3);
  out.push(...catHits);

  return out.slice(0, limit);
}

/** Reset the memoised index (tests only). */
export function _resetIndex(): void {
  cache = null;
}
