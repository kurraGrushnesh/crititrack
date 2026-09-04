/**
 * The category system — a global people-discovery taxonomy built on top
 * of the roster in `lib/catalog.ts` and the profession taxonomy in
 * `lib/taxonomy`. Every category is a real, named area of work; a person
 * belongs to a category because their resolved occupation, industry or
 * sector matches it, never because the category was invented to fit them.
 *
 * A person keeps exactly one profile (`RosterEntry`/Wikidata record) but
 * can appear in several categories — an entrepreneur who is also an AI
 * researcher shows up under both. Nothing here duplicates a profile;
 * `categoriesFor` only tags the existing roster entry.
 *
 * Matching is taxonomy-driven and layered narrow → broad:
 *   1. `occupations` — exact occupation ids (e.g. "chef", "youtuber").
 *   2. `industries` — a taxonomy industry (e.g. "journalism").
 *   3. `sectors` — a whole taxonomy sector, for the broadest categories
 *      (e.g. "Technology" covers every technology industry).
 * A category needs only one of the three; an entry matches a category if
 * any of them hits. When a descriptor does not resolve on the taxonomy at
 * all, the entry falls back to its legacy roster category rather than
 * being dropped from discovery entirely.
 */

import { resolveCatalogueOccupation } from "./professional-identity";
import {
  CATEGORIES as LEGACY_CATEGORIES,
  CATEGORY_HINT,
  type RosterEntry,
} from "./catalog";

export interface DiscoveryCategory {
  slug: string;
  label: string;
  blurb: string;
  /** True for the handful of categories surfaced first in the explorer. */
  featured?: boolean;
  sectors?: string[];
  industries?: string[];
  occupations?: string[];
  /** The pre-existing 6-category slug this absorbs, for continuity. */
  legacySlug?: string;
}

export const CATEGORIES: DiscoveryCategory[] = [
  {
    slug: "actors-filmmakers",
    label: "Actors & Filmmakers",
    blurb: "Film, television and stage performers, directors and producers.",
    featured: true,
    // Stage and dance performers are grouped here rather than with music:
    // a theatre actor or dancer is a performer, not a musician.
    industries: ["screen-performance", "filmmaking", "stage-and-dance"],
    legacySlug: "actors",
  },
  {
    slug: "musicians-singers",
    label: "Musicians & Singers",
    blurb: "Recording artists, songwriters, composers and performers.",
    featured: true,
    industries: ["music"],
    legacySlug: "musicians",
  },
  {
    slug: "politicians-government",
    label: "Politicians & Government",
    blurb: "Elected officials, heads of government and diplomats.",
    featured: true,
    industries: ["elected-office", "diplomacy"],
    legacySlug: "politicians",
  },
  {
    slug: "athletes-sports",
    label: "Athletes & Sports",
    blurb: "Competitors, champions and coaches across major sports.",
    featured: true,
    sectors: ["sports"],
    legacySlug: "athletes",
  },
  {
    slug: "business-leaders",
    label: "Business Leaders",
    blurb: "Chief executives, chairs and senior operating leaders.",
    featured: true,
    industries: ["executive-leadership", "management-operations", "sales-and-marketing"],
    legacySlug: "business",
  },
  {
    slug: "entrepreneurs-founders",
    label: "Entrepreneurs & Founders",
    blurb: "Company founders, co-founders and startup investors.",
    industries: ["entrepreneurship"],
    occupations: ["technology-entrepreneur"],
  },
  {
    slug: "technology",
    label: "Technology",
    blurb: "Software, infrastructure, security and tech leadership.",
    featured: true,
    sectors: ["technology"],
  },
  {
    slug: "ai-machine-learning",
    label: "AI & Machine Learning",
    blurb: "Researchers, engineers and leaders building AI systems.",
    industries: ["artificial-intelligence"],
  },
  {
    slug: "scientists-researchers",
    label: "Scientists & Researchers",
    blurb: "Physical, life, social and mathematical scientists.",
    sectors: ["science-research"],
  },
  {
    slug: "doctors-healthcare",
    label: "Doctors & Healthcare",
    blurb: "Physicians, public-health officials and biomedical leaders.",
    sectors: ["healthcare"],
  },
  {
    slug: "academics-professors",
    label: "Academics & Professors",
    blurb: "University faculty and higher-education leadership.",
    industries: ["higher-education"],
  },
  {
    slug: "lawyers-legal",
    label: "Lawyers & Legal",
    blurb: "Attorneys, judges and legal practitioners.",
    sectors: ["law"],
  },
  {
    slug: "writers-authors",
    label: "Writers & Authors",
    blurb: "Novelists, poets and non-fiction authors.",
    industries: ["literature"],
  },
  {
    slug: "journalists-media",
    label: "Journalists & Media",
    blurb: "Reporters, editors, anchors and broadcasters.",
    industries: ["journalism", "broadcasting"],
  },
  {
    slug: "creators-influencers",
    label: "Creators & Influencers",
    blurb: "People known primarily for work published online.",
    featured: true,
    industries: ["online-creation"],
    legacySlug: "creators",
  },
  {
    slug: "youtubers-streamers",
    label: "YouTubers & Streamers",
    blurb: "Video creators and live streamers on YouTube and Twitch.",
    occupations: ["youtuber", "game-streamer"],
  },
  {
    slug: "artists-designers",
    label: "Artists & Designers",
    blurb: "Visual artists, illustrators and designers.",
    industries: ["visual-arts", "design"],
  },
  {
    slug: "fashion",
    label: "Fashion",
    blurb: "Designers, models and figures in fashion and beauty.",
    sectors: ["fashion-beauty"],
  },
  {
    slug: "finance-investors",
    label: "Finance & Investors",
    blurb: "Bankers, asset managers and fintech leaders.",
    industries: ["banking", "investment-management", "fintech-crypto"],
  },
  {
    slug: "economists",
    label: "Economists",
    blurb: "Economists working in research, policy and academia.",
    occupations: ["economist"],
  },
  {
    slug: "engineers",
    label: "Engineers",
    blurb: "Engineers across mechanical, civil, aerospace and other fields.",
    sectors: ["engineering"],
  },
  {
    slug: "architects",
    label: "Architects",
    blurb: "Architects and building designers.",
    industries: ["architecture"],
  },
  {
    slug: "military-defense",
    label: "Military & Defense",
    blurb: "Armed-forces officers and defence leadership.",
    industries: ["armed-forces"],
  },
  {
    slug: "police-law-enforcement",
    label: "Police & Law Enforcement",
    blurb: "Police, intelligence and law-enforcement leadership.",
    industries: ["policing-intelligence"],
  },
  {
    slug: "activists-human-rights",
    label: "Activists & Human Rights",
    blurb: "Advocates and organisers for social and political causes.",
    industries: ["activism-advocacy"],
  },
  {
    slug: "religious-spiritual-leaders",
    label: "Religious & Spiritual Leaders",
    blurb: "Clergy and leaders of faith and spiritual communities.",
    industries: ["social-care-and-faith"],
  },
  {
    slug: "royalty-public-figures",
    label: "Royalty & Public Figures",
    blurb: "Monarchs, nobility and hereditary public figures.",
    occupations: ["monarch", "noble"],
  },
  {
    slug: "chefs-food",
    label: "Chefs & Food",
    blurb: "Chefs, restaurateurs and other food professionals.",
    occupations: ["chef"],
  },
  {
    slug: "explorers-adventurers",
    label: "Explorers & Adventurers",
    blurb: "Explorers, expedition leaders and adventurers.",
    occupations: ["explorer"],
  },
  {
    slug: "esports-gaming",
    label: "Esports & Gaming",
    blurb: "Competitive gamers, coaches and game developers.",
    industries: ["esports-gaming"],
  },
  {
    slug: "environmental-climate",
    label: "Environmental & Climate",
    blurb: "Environmental scientists, conservationists and climate advocates.",
    industries: ["environment-conservation"],
  },
  {
    slug: "social-community-leaders",
    label: "Social & Community Leaders",
    blurb: "Nonprofit, humanitarian and community leadership.",
    industries: ["nonprofit-humanitarian"],
  },
  {
    slug: "education",
    label: "Education",
    blurb: "Educators and leaders across schools and higher education.",
    sectors: ["education"],
  },
  {
    slug: "real-estate",
    label: "Real Estate",
    blurb: "Property developers, investors and real-estate executives.",
    industries: ["real-estate"],
  },
  {
    slug: "other-notable-people",
    label: "Other Notable People",
    blurb: "Public figures whose work does not fit another category.",
    sectors: ["other"],
  },
];

/** Old 6-category slug → its replacement, so existing links keep working. */
const SLUG_ALIASES: Record<string, string> = Object.fromEntries(
  CATEGORIES.filter((c) => c.legacySlug).map((c) => [c.legacySlug!, c.slug]),
);

/** Every slug a static build must generate a page for: new + legacy. */
export const ALL_CATEGORY_SLUGS: string[] = [
  ...CATEGORIES.map((c) => c.slug),
  ...Object.keys(SLUG_ALIASES),
];

export function categoryBySlug(slug: string): DiscoveryCategory | undefined {
  const canonical = SLUG_ALIASES[slug] ?? slug;
  return CATEGORIES.find((c) => c.slug === canonical);
}

/** Resolves a slug (old or new) to the slug `rosterForCategory` expects. */
export function canonicalCategorySlug(slug: string): string {
  return SLUG_ALIASES[slug] ?? slug;
}

interface ResolvedIds {
  sectorId: string;
  industryId: string;
  occupationId: string;
}

function resolvedIdsFor(entry: RosterEntry): ResolvedIds | null {
  const r = resolveCatalogueOccupation(entry.descriptor);
  if (r) {
    return {
      sectorId: r.path.sectorId,
      industryId: r.path.industryId,
      occupationId: r.occupationId,
    };
  }
  // The same last-resort hint `catalogueProfession` uses in
  // lib/catalog.ts (one shared map), so a person who is discoverable on
  // a category page is discoverable in Professional Identity too.
  const hint = CATEGORY_HINT[entry.category];
  const rh = hint ? resolveCatalogueOccupation(hint) : null;
  return rh
    ? { sectorId: rh.path.sectorId, industryId: rh.path.industryId, occupationId: rh.occupationId }
    : null;
}

function matches(cat: DiscoveryCategory, ids: ResolvedIds | null): boolean {
  if (!ids) return false;
  if (cat.occupations?.includes(ids.occupationId)) return true;
  if (cat.industries?.includes(ids.industryId)) return true;
  if (cat.sectors?.includes(ids.sectorId)) return true;
  return false;
}

/**
 * How specifically a person's own `descriptor` places them in the
 * taxonomy — a real, computed signal (not a popularity or activity
 * metric) used to rank a category page: "direct" when the descriptor's
 * own wording resolved a taxonomy occupation, "hint" when only the
 * roster's category tag did (see {@link CATEGORY_HINT}), "none" when
 * neither did (the entry only appears via the legacy-category fallback).
 */
export type ResolutionQuality = "direct" | "hint" | "none";

export function resolutionQuality(entry: RosterEntry): ResolutionQuality {
  if (resolveCatalogueOccupation(entry.descriptor)) return "direct";
  if (CATEGORY_HINT[entry.category]) return "hint";
  return "none";
}

/**
 * Every category a roster entry belongs to. Never empty for a roster
 * entry with a real `category` — if nothing on the taxonomy matches, the
 * entry's legacy category (renamed to its new label) is used so no one
 * silently drops out of discovery.
 */
export function categoriesFor(entry: RosterEntry): DiscoveryCategory[] {
  const ids = resolvedIdsFor(entry);
  const found = CATEGORIES.filter((c) => matches(c, ids));

  const legacyCat = CATEGORIES.find((c) => c.legacySlug === entry.category);
  if (legacyCat && !found.includes(legacyCat)) found.push(legacyCat);

  if (found.length > 0) return found;

  // Nothing resolved at all (should not happen for a real roster entry,
  // whose category always has a matching legacy category) — fall back to
  // "Other Notable People" rather than making the person undiscoverable.
  const other = CATEGORIES.find((c) => c.slug === "other-notable-people");
  return other ? [other] : [];
}

/** People discoverable under one category slug (old or new). */
export function rosterForCategory(slug: string, roster: RosterEntry[]): RosterEntry[] {
  const canonical = canonicalCategorySlug(slug);
  return roster.filter((e) => categoriesFor(e).some((c) => c.slug === canonical));
}

/**
 * Ranks a category's members for display. This is a relevance ranking,
 * not a popularity one: a person whose own descriptor resolved the
 * category directly outranks one who only landed here via the
 * last-resort category hint, and a person with a recorded country (a
 * completeness signal) outranks one without — both real, computed
 * facts, never an invented "activity" or "trending" number. Editorial
 * roster order is the final tiebreaker, same rule the legacy catalogue
 * always used.
 *
 * Live signals this deliberately does not use — recent news volume,
 * attention, sentiment, CritiScore — only exist once a real profile is
 * fetched; the catalogue never fetches one in bulk to avoid exactly the
 * "popularity decides everything" ranking the spec warns against, and to
 * avoid an expensive per-person request on every catalogue page load.
 */
export function rankCategoryMembers(members: RosterEntry[]): RosterEntry[] {
  const qualityScore: Record<ResolutionQuality, number> = {
    direct: 2,
    hint: 1,
    none: 0,
  };
  return members
    .map((entry, order) => ({ entry, order }))
    .sort((a, b) => {
      const q = qualityScore[resolutionQuality(b.entry)] - qualityScore[resolutionQuality(a.entry)];
      if (q !== 0) return q;
      const completeness = Number(!!b.entry.country) - Number(!!a.entry.country);
      if (completeness !== 0) return completeness;
      return a.order - b.order;
    })
    .map((x) => x.entry);
}

/** Editorial prominence order = the roster's own order (same rule as
 * the legacy catalogue's `topTen` — unchanged, so existing categories
 * keep their established Top 10). Fewer than 10 real people means fewer
 * than 10 shown — never padded. Callers that want the relevance-ranked
 * order instead (useful once a category's members were not hand-ordered
 * by prominence) can sort with {@link rankCategoryMembers} directly. */
export function topTenForCategory(
  slug: string,
  roster: RosterEntry[],
): RosterEntry[] {
  return rosterForCategory(slug, roster).slice(0, 10);
}

/** How many roster people fall under each category — for the explorer. */
export function categoryCounts(roster: RosterEntry[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of CATEGORIES) counts[c.slug] = 0;
  for (const entry of roster) {
    for (const c of categoriesFor(entry)) counts[c.slug]++;
  }
  return counts;
}

// Re-exported so a caller only needs one module for the whole system.
export { LEGACY_CATEGORIES };
