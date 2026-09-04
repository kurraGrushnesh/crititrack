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
  getOccupation,
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
  /** Domains from Wikidata "field of work" (P101). Empty when none. */
  expertise: string[];
  /**
   * A one-word derived summary of where the person sits professionally —
   * "Former", "Executive", "Academic", "Researcher", "Active" — or null
   * when there is no signal. Derived from the data, never invented.
   */
  careerStatus: string | null;
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
  careerStatus: null,
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

/** Tidy a Wikidata field-of-work label for display as an expertise chip. */
function cleanExpertise(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ");
  // Wikidata labels are lowercase ("artificial intelligence"); Title-case
  // the leading letter of each word unless it already has capitals.
  if (/[A-Z]/.test(s)) return s;
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Derived career-status label, from real signals only:
 *   deceased            → null (the concept does not apply)
 *   "former"/"retired"  → "Former"
 *   executive/founder   → "Executive"
 *   professor/academic  → "Academic"
 *   researcher/scientist→ "Researcher"
 *   otherwise, if there is a resolved profession or role → "Active"
 *   nothing             → null
 */
function deriveCareerStatus(args: {
  deceased: boolean;
  professionText: string;
  roles: string[];
  occupationLabels: string[];
  primarySectorId: string | null;
}): string | null {
  if (args.deceased) return null;
  const text = `${args.professionText} ${args.roles.join(" ")}`.toLowerCase();
  if (/\b(former|ex[-\s])/.test(text) || /\bretired\b/.test(text)) return "Former";

  const occ = args.occupationLabels.map((l) => l.toLowerCase());
  const any = (re: RegExp) => occ.some((l) => re.test(l));
  if (any(/chief executive|entrepreneur|founder|executive|managing director/)) {
    return "Executive";
  }
  if (args.primarySectorId === "education" || any(/professor|lecturer|academic/)) {
    return "Academic";
  }
  if (
    args.primarySectorId === "science-research" ||
    any(/researcher|scientist/)
  ) {
    return "Researcher";
  }

  return occ.length > 0 || args.roles.length > 0 ? "Active" : null;
}

export function buildProfessionalIdentity(input: {
  occupations?: string[];
  professionText?: string;
  /** Wikidata "field of work" (P101) labels. */
  fieldsOfWork?: string[];
  /** Whether the person has a recorded death date. */
  deceased?: boolean;
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

  // Expertise: Wikidata "field of work" labels, deduped, cleaned, capped.
  const seenExpertise = new Set<string>();
  const expertise: string[] = [];
  for (const raw of input.fieldsOfWork ?? []) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const clean = cleanExpertise(raw);
    const key = clean.toLowerCase();
    if (seenExpertise.has(key)) continue;
    seenExpertise.add(key);
    expertise.push(clean);
    if (expertise.length >= 6) break;
  }

  const occupationLabels = [
    ...(primary ? [primary.label] : []),
    ...secondary.map((s) => s.label),
  ];

  const identity: ProfessionalIdentity = {
    primary,
    secondary,
    roles,
    industries: [...industryById.values()],
    specializations: [...specById.values()],
    expertise,
    careerStatus: deriveCareerStatus({
      deceased: input.deceased === true,
      professionText,
      roles,
      occupationLabels,
      primarySectorId: primary?.path.sectorId ?? null,
    }),
    unresolved,
    empty: false,
  };
  identity.empty =
    !identity.primary &&
    identity.secondary.length === 0 &&
    identity.roles.length === 0 &&
    identity.specializations.length === 0 &&
    identity.expertise.length === 0;

  return identity.empty ? EMPTY : identity;
}

/**
 * Role-phrase prefixes common in catalogue descriptors, mapped to a
 * taxonomy occupation id. "Co-founder of Infosys", "Prime Minister of
 * India", "Chair of the Adani Group" — the office/role is the first
 * words, the organisation follows.
 */
const ROLE_PREFIXES: [RegExp, string][] = [
  [/^(co[-\s]?)?founder\b/i, "entrepreneur"],
  [/^(executive\s+)?chair(person|man|woman)?\b/i, "chairperson"],
  [/^(chief executive|ceo)\b/i, "chief-executive-officer"],
  [/^managing director\b/i, "chief-executive-officer"],
  [/^chief (operating|financial|technology|marketing) officer\b/i, "chief-executive-officer"],
  [/^(former\s+)?(president|prime minister|vice[-\s]president|chancellor|governor|senator|congress(man|woman)|first minister|premier)\b/i, "politician"],
  [/^(united states|u\.?s\.?)\s+(representative|senator)\b/i, "politician"],
  [/^general secretary\b/i, "politician"],
  [/^chief (medical|sustainability) officer\b/i, "public-health-official"],
];

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

  // Role-phrase prefix ("Co-founder of …", "Prime Minister of …").
  for (const [re, occId] of ROLE_PREFIXES) {
    if (re.test(descriptor.trim())) {
      const occ = getOccupation(occId);
      const path = occ && occupationPath(occ.id);
      if (occ && path) return { label: occ.label, path };
    }
  }

  return null;
}

export { occupationPath };
