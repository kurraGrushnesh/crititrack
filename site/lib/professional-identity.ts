/**
 * Builds a person's Professional Identity from the sourced data the
 * profile already carries — Wikidata `P106` occupation claims and the
 * generated "primary profession" line — mapped onto the global taxonomy
 * in `lib/taxonomy`.
 *
 * A person is never forced into one occupation: every resolved claim is
 * kept (primary + secondary), specialisations are surfaced under their
 * parent occupation, and industries are derived from the occupation
 * paths. Anything that does not resolve is listed in `unresolved` rather
 * than mis-filed, and `expertise` stays empty until there is a source
 * for it.
 */

import {
  resolveOccupation,
  occupationPath,
  getSector,
  type OccupationPath,
} from "./taxonomy";

export interface ProfessionEntry {
  /** Taxonomy occupation id. */
  id: string;
  /** Canonical taxonomy label. */
  label: string;
  /** The raw source label this was resolved from. */
  original: string;
  path: OccupationPath;
}

export interface SpecializationEntry {
  id: string;
  label: string;
  /** Canonical label of the occupation this specialises. */
  occupation: string;
  original: string;
}

export interface IndustryEntry {
  id: string;
  label: string;
  sector: string;
}

export interface ProfessionalIdentity {
  primary: ProfessionEntry | null;
  secondary: ProfessionEntry[];
  /** Free-text current/notable roles, e.g. "Chief executive of Apple". */
  roles: string[];
  industries: IndustryEntry[];
  specializations: SpecializationEntry[];
  /** Skills / topics. Empty until a reliable source is wired. */
  expertise: string[];
  /** Source occupation labels that did not map to the taxonomy. */
  unresolved: string[];
  /** True when there is nothing worth rendering. */
  empty: boolean;
}

const EMPTY: ProfessionalIdentity = {
  primary: null,
  secondary: [],
  roles: [],
  industries: [],
  specializations: [],
  expertise: [],
  unresolved: [],
  empty: true,
};

function toEntry(
  original: string,
  r: NonNullable<ReturnType<typeof resolveOccupation>>,
): ProfessionEntry {
  return { id: r.occupation.id, label: r.occupation.label, original, path: r.path };
}

/** A profession line reads as a *role* when it names an org or seat. */
function looksLikeRole(text: string): boolean {
  return /\b(of|at|for)\b/i.test(text) || /\d/.test(text);
}

export function buildProfessionalIdentity(input: {
  occupations?: string[];
  professionText?: string;
}): ProfessionalIdentity {
  const rawOccupations = (input.occupations ?? [])
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);
  const professionText = (input.professionText ?? "").trim();

  const occById = new Map<string, ProfessionEntry>();
  const specById = new Map<string, SpecializationEntry>();
  const industryById = new Map<string, IndustryEntry>();
  const unresolved: string[] = [];
  let firstResolved: ProfessionEntry | null = null;

  const addIndustry = (path: OccupationPath) => {
    if (industryById.has(path.industryId)) return;
    const sector = getSector(path.sectorId);
    industryById.set(path.industryId, {
      id: path.industryId,
      label: path.industry,
      sector: sector?.label ?? path.sector,
    });
  };

  for (const raw of rawOccupations) {
    const r = resolveOccupation(raw);
    if (!r) {
      unresolved.push(raw);
      continue;
    }
    const entry = toEntry(raw, r);
    if (!occById.has(entry.id)) {
      occById.set(entry.id, entry);
      if (!firstResolved) firstResolved = entry;
    }
    addIndustry(r.path);
    if (r.specialization && !specById.has(r.specialization.id)) {
      specById.set(r.specialization.id, {
        id: r.specialization.id,
        label: r.specialization.label,
        occupation: r.occupation.label,
        original: raw,
      });
    }
  }

  // Primary: the first resolved Wikidata occupation; failing that, the
  // generated profession line if *it* resolves.
  let primary = firstResolved;
  if (!primary && professionText && !looksLikeRole(professionText)) {
    const r = resolveOccupation(professionText);
    if (r) {
      primary = toEntry(professionText, r);
      occById.set(primary.id, primary);
      addIndustry(r.path);
    }
  }

  const secondary = [...occById.values()].filter((e) => e.id !== primary?.id);

  // Roles: the generated profession line when it names a seat/org and is
  // not just a restatement of the primary occupation.
  const roles: string[] = [];
  if (
    professionText &&
    looksLikeRole(professionText) &&
    professionText.toLowerCase() !== (primary?.label.toLowerCase() ?? "")
  ) {
    roles.push(professionText);
  }

  const identity: ProfessionalIdentity = {
    primary,
    secondary,
    roles,
    industries: [...industryById.values()],
    specializations: [...specById.values()],
    expertise: [],
    unresolved,
    empty: false,
  };
  identity.empty =
    !identity.primary &&
    identity.secondary.length === 0 &&
    identity.roles.length === 0 &&
    identity.specializations.length === 0;

  return identity.empty ? EMPTY : identity;
}

/** Convenience for the catalogue: resolve one descriptor to a path. */
export function resolveCatalogueOccupation(descriptor: string): {
  label: string;
  path: OccupationPath;
} | null {
  const r = resolveOccupation(descriptor);
  if (r) return { label: r.occupation.label, path: r.path };
  // The descriptor often carries a nationality prefix ("Indian javelin
  // thrower"); retry on the trailing words.
  const words = descriptor.trim().split(/\s+/);
  for (let start = 1; start < Math.min(words.length, 3); start++) {
    const tail = words.slice(start).join(" ");
    const rt = resolveOccupation(tail);
    if (rt) return { label: rt.occupation.label, path: rt.path };
  }
  return null;
}

export { occupationPath };
