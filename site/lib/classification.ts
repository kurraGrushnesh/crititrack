import type { RealProfile } from "./api";
import { parseSafeUrl } from "./safe-url";

/**
 * The classification schema for a public figure.
 *
 * Every facet is one small extractor: it takes the profile and returns a
 * {@link Facet} when the underlying data is actually present, or `null`
 * when it isn't. The panel renders whatever comes back. Adding a new
 * classification (say "Genres" or "Sports teams" once the backend sends
 * them) is one function appended to {@link EXTRACTORS} — no component
 * change, no layout rewrite. That is the "broad extensible schema"
 * requirement: the UI never hardcodes the facet list.
 *
 * Values are only ever taken from real source fields
 * (`entity.facts`, `biography`). Nothing here is inferred or invented.
 */

export type FacetKind = "tags" | "text" | "links" | "timeline";

export interface FacetItem {
  label: string;
  /** Present for `links` items; must be a safe https URL. */
  href?: string;
  /** Present for `timeline` items. */
  meta?: string;
}

export interface Facet {
  key: string;
  /** Section this facet belongs under, for grouping in the panel. */
  group: "Identity" | "Career" | "Recognition" | "Presence";
  label: string;
  kind: FacetKind;
  items: FacetItem[];
}

type Extractor = (p: RealProfile) => Facet | null;

const tags = (
  key: string,
  group: Facet["group"],
  label: string,
  values: string[],
): Facet | null =>
  values.length > 0
    ? { key, group, label, kind: "tags", items: values.map((v) => ({ label: v })) }
    : null;

const LINK_LABELS: Record<string, string> = {
  website: "Official site",
  x: "X",
  twitter: "X",
  instagram: "Instagram",
  imdb: "IMDb",
  youtube: "YouTube",
  facebook: "Facebook",
  tiktok: "TikTok",
  wikipedia: "Wikipedia",
};

function humanYear(iso?: string): string | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})/.exec(iso);
  return m ? m[1] : undefined;
}

const EXTRACTORS: Extractor[] = [
  // ── Identity ────────────────────────────────────────────────────
  (p) => {
    const parts: string[] = [];
    const born = humanYear(p.facts.birthDate);
    if (born) parts.push(`Born ${born}${p.facts.birthPlace ? `, ${p.facts.birthPlace}` : ""}`);
    else if (p.facts.birthPlace) parts.push(p.facts.birthPlace);
    const died = humanYear(p.facts.deathDate);
    if (died) parts.push(`Died ${died}`);
    return parts.length
      ? {
          key: "life",
          group: "Identity",
          label: "Life",
          kind: "text",
          items: parts.map((label) => ({ label })),
        }
      : null;
  },
  (p) => tags("nationality", "Identity", "Nationality", p.facts.citizenship),
  (p) => tags("education", "Identity", "Education", p.facts.education),
  (p) => {
    if (!p.entityDescription) return null;
    return {
      key: "wikidata-summary",
      group: "Identity",
      label: "Wikidata",
      kind: "text",
      items: [{ label: p.entityDescription }],
    };
  },

  // ── Career ──────────────────────────────────────────────────────
  (p) => {
    const occ = p.facts.occupations.length
      ? p.facts.occupations
      : p.profession
        ? [p.profession]
        : [];
    return tags("occupations", "Career", "Occupations", occ);
  },
  (p) => {
    const works = p.notableWorks.length ? p.notableWorks : p.facts.notableWorks;
    return tags("works", "Career", "Notable works", works);
  },

  // ── Recognition ─────────────────────────────────────────────────
  (p) => {
    if (p.facts.awards.length === 0) return null;
    return {
      key: "awards",
      group: "Recognition",
      label: "Awards",
      kind: "timeline",
      items: [...p.facts.awards]
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
        .map((a) => ({ label: a.label, meta: a.year ? String(a.year) : undefined })),
    };
  },

  // ── Presence ────────────────────────────────────────────────────
  (p) => {
    const items: FacetItem[] = [];
    for (const [key, raw] of Object.entries(p.facts.links)) {
      const safe = parseSafeUrl(raw);
      if (!safe) continue;
      items.push({
        label: LINK_LABELS[key.toLowerCase()] ?? key,
        href: safe.toString(),
      });
    }
    return items.length
      ? { key: "links", group: "Presence", label: "Profiles", kind: "links", items }
      : null;
  },
];

export const FACET_GROUPS: Facet["group"][] = [
  "Identity",
  "Career",
  "Recognition",
  "Presence",
];

/** Runs every extractor and returns the facets that had real data. */
export function buildClassification(p: RealProfile): Facet[] {
  const out: Facet[] = [];
  for (const ex of EXTRACTORS) {
    const f = ex(p);
    if (f && f.items.length > 0) out.push(f);
  }
  return out;
}
