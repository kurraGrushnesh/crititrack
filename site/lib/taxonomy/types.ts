/**
 * Global professional taxonomy — shape only.
 *
 * Five levels: Sector → Industry → Occupation Family → Occupation →
 * Specialization. The tree is authored in `data.ts` as nested nodes for
 * readability, then flattened into id-keyed lookup maps in `index.ts`.
 *
 * Everything here is data, never a React component. A person is never
 * forced into a single occupation — see `professional-identity.ts` for
 * how Wikidata occupation claims are mapped onto multiple entries.
 *
 * Ids are stable kebab-case slugs. Labels are the canonical display
 * names. `aliases` hold synonyms, abbreviations, regional and historical
 * titles, and emerging variants so free-text occupation strings (from
 * Wikidata `P106`, from a bio) resolve onto the right node.
 */

export interface TaxonomyOccupationNode {
  id: string;
  label: string;
  /** Synonyms / abbreviations / regional / historical / emerging titles. */
  aliases?: string[];
  /** Finer roles under this occupation, e.g. "Cardiologist" under "Physician". */
  specializations?: string[];
}

export interface TaxonomyFamilyNode {
  id: string;
  label: string;
  occupations: TaxonomyOccupationNode[];
}

export interface TaxonomyIndustryNode {
  id: string;
  label: string;
  aliases?: string[];
  families: TaxonomyFamilyNode[];
}

export interface TaxonomySectorNode {
  id: string;
  label: string;
  aliases?: string[];
  industries: TaxonomyIndustryNode[];
}

// ── Flattened lookup records (built in index.ts) ────────────────────

export interface Sector {
  kind: "sector";
  id: string;
  label: string;
}

export interface Industry {
  kind: "industry";
  id: string;
  label: string;
  sectorId: string;
}

export interface OccupationFamily {
  kind: "family";
  id: string;
  label: string;
  industryId: string;
  sectorId: string;
}

export interface Occupation {
  kind: "occupation";
  id: string;
  label: string;
  familyId: string;
  industryId: string;
  sectorId: string;
  aliases: string[];
  specializationIds: string[];
}

export interface Specialization {
  kind: "specialization";
  id: string;
  label: string;
  occupationId: string;
  familyId: string;
  industryId: string;
  sectorId: string;
}

/** The full path from a leaf back to its sector, for display and filtering. */
export interface OccupationPath {
  sectorId: string;
  sector: string;
  industryId: string;
  industry: string;
  familyId: string;
  family: string;
}
