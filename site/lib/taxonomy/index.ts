/**
 * Flattened lookups + resolution over the professional taxonomy.
 *
 * The nested tree in `data.ts` is walked once at module load into
 * id-keyed maps and a normalised-string alias index. `resolveOccupation`
 * turns a free-text occupation label — from a Wikidata `P106` claim, a
 * bio, or a catalogue descriptor — into a taxonomy node, or returns null
 * (never a guess).
 */

import { TAXONOMY } from "./data";
import type {
  Sector,
  Industry,
  OccupationFamily,
  Occupation,
  Specialization,
  OccupationPath,
} from "./types";

export * from "./types";
export { TAXONOMY } from "./data";

// ── Flatten ────────────────────────────────────────────────────────

const sectors = new Map<string, Sector>();
const industries = new Map<string, Industry>();
const families = new Map<string, OccupationFamily>();
const occupations = new Map<string, Occupation>();
const specializations = new Map<string, Specialization>();

/** normalised alias/label → the node it points at (first writer wins). */
type IndexHit =
  | { kind: "occupation"; id: string }
  | { kind: "specialization"; id: string }
  | { kind: "industry"; id: string }
  | { kind: "sector"; id: string };
const aliasIndex = new Map<string, IndexHit>();

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalizeLabel(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[().,'"’/\\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function indexAlias(key: string, hit: IndexHit): void {
  const k = normalizeLabel(key);
  if (!k || aliasIndex.has(k)) return;
  aliasIndex.set(k, hit);
}

let specSeq = 0;

for (const s of TAXONOMY) {
  sectors.set(s.id, { kind: "sector", id: s.id, label: s.label });
  indexAlias(s.label, { kind: "sector", id: s.id });
  for (const a of s.aliases ?? []) indexAlias(a, { kind: "sector", id: s.id });

  for (const ind of s.industries) {
    industries.set(ind.id, {
      kind: "industry",
      id: ind.id,
      label: ind.label,
      sectorId: s.id,
    });
    indexAlias(ind.label, { kind: "industry", id: ind.id });
    for (const a of ind.aliases ?? []) {
      indexAlias(a, { kind: "industry", id: ind.id });
    }

    for (const fam of ind.families) {
      families.set(fam.id, {
        kind: "family",
        id: fam.id,
        label: fam.label,
        industryId: ind.id,
        sectorId: s.id,
      });

      for (const occ of fam.occupations) {
        const specIds: string[] = [];
        for (const specLabel of occ.specializations ?? []) {
          const specId = `${occ.id}--${slug(specLabel)}-${specSeq++}`;
          specializations.set(specId, {
            kind: "specialization",
            id: specId,
            label: specLabel,
            occupationId: occ.id,
            familyId: fam.id,
            industryId: ind.id,
            sectorId: s.id,
          });
          indexAlias(specLabel, { kind: "specialization", id: specId });
          specIds.push(specId);
        }

        occupations.set(occ.id, {
          kind: "occupation",
          id: occ.id,
          label: occ.label,
          familyId: fam.id,
          industryId: ind.id,
          sectorId: s.id,
          aliases: occ.aliases ?? [],
          specializationIds: specIds,
        });
        indexAlias(occ.label, { kind: "occupation", id: occ.id });
        for (const a of occ.aliases ?? []) {
          indexAlias(a, { kind: "occupation", id: occ.id });
        }
      }
    }
  }
}

function slug(s: string): string {
  return normalizeLabel(s).replace(/\s+/g, "-");
}

// ── Public maps / lists ────────────────────────────────────────────

export const SECTORS: readonly Sector[] = [...sectors.values()];
export const INDUSTRIES: readonly Industry[] = [...industries.values()];
export const FAMILIES: readonly OccupationFamily[] = [...families.values()];
export const OCCUPATIONS: readonly Occupation[] = [...occupations.values()];
export const SPECIALIZATIONS: readonly Specialization[] = [
  ...specializations.values(),
];

export function getSector(id: string): Sector | undefined {
  return sectors.get(id);
}
export function getIndustry(id: string): Industry | undefined {
  return industries.get(id);
}
export function getOccupation(id: string): Occupation | undefined {
  return occupations.get(id);
}
export function getSpecialization(id: string): Specialization | undefined {
  return specializations.get(id);
}

/** Counts, for the report and a taxonomy-completeness test. */
export const TAXONOMY_STATS = {
  sectors: sectors.size,
  industries: industries.size,
  families: families.size,
  occupations: occupations.size,
  specializations: specializations.size,
  aliases: aliasIndex.size,
};

// ── Path ───────────────────────────────────────────────────────────

export function occupationPath(occupationId: string): OccupationPath | null {
  const occ = occupations.get(occupationId);
  if (!occ) return null;
  const fam = families.get(occ.familyId);
  const ind = industries.get(occ.industryId);
  const sec = sectors.get(occ.sectorId);
  if (!fam || !ind || !sec) return null;
  return {
    sectorId: sec.id,
    sector: sec.label,
    industryId: ind.id,
    industry: ind.label,
    familyId: fam.id,
    family: fam.label,
  };
}

// ── Resolution ─────────────────────────────────────────────────────

export interface ResolvedOccupation {
  /** The occupation node this label lands on. */
  occupation: Occupation;
  /** Set when the label was actually a specialization of `occupation`. */
  specialization: Specialization | null;
  path: OccupationPath;
  /** How the match was made — for transparency, never shown as certainty. */
  via: "label" | "alias" | "specialization" | "contains";
}

/** Common noise words in occupation strings that don't change the match. */
const STRIP_PREFIXES = [
  "professional",
  "former",
  "retired",
  "amateur",
  "competitive",
];

function stripNoise(norm: string): string {
  let out = norm;
  for (const p of STRIP_PREFIXES) {
    if (out.startsWith(p + " ")) out = out.slice(p.length + 1);
  }
  return out.trim();
}

/**
 * Resolves a free-text occupation label to a taxonomy node, or null.
 *
 * Order: exact label/alias → specialization → noise-stripped retry →
 * a conservative "contains a known occupation phrase" fallback. Anything
 * that does not land is returned as null so the caller can list it as
 * unresolved rather than mis-file it.
 */
export function resolveOccupation(raw: string): ResolvedOccupation | null {
  if (typeof raw !== "string") return null;
  const norm = normalizeLabel(raw);
  if (norm.length < 2) return null;

  const tryHit = (hit: IndexHit | undefined, via: ResolvedOccupation["via"]) => {
    if (!hit) return null;
    if (hit.kind === "occupation") {
      const occ = occupations.get(hit.id);
      const path = occ && occupationPath(occ.id);
      return occ && path ? { occupation: occ, specialization: null, path, via } : null;
    }
    if (hit.kind === "specialization") {
      const spec = specializations.get(hit.id);
      const occ = spec && occupations.get(spec.occupationId);
      const path = occ && occupationPath(occ.id);
      return spec && occ && path
        ? { occupation: occ, specialization: spec, path, via: "specialization" as const }
        : null;
    }
    return null; // industry/sector hits are not occupations
  };

  // 1. exact
  const exact = tryHit(aliasIndex.get(norm), "alias");
  if (exact) return { ...exact, via: aliasKind(norm) };

  // 2. noise-stripped
  const stripped = stripNoise(norm);
  if (stripped !== norm) {
    const s = tryHit(aliasIndex.get(stripped), "alias");
    if (s) return { ...s, via: aliasKind(stripped) };
  }

  // 3. contains a known multi-word occupation/alias phrase (conservative:
  //    only phrases of two or more words, to avoid "artist" matching
  //    inside "makeup artist" the wrong way — longest phrase wins).
  let best: { hit: IndexHit; len: number } | null = null;
  for (const [key, hit] of aliasIndex) {
    if (hit.kind !== "occupation" && hit.kind !== "specialization") continue;
    if (!key.includes(" ")) continue;
    if (stripped.includes(key) && (!best || key.length > best.len)) {
      best = { hit, len: key.length };
    }
  }
  if (best) {
    const c = tryHit(best.hit, "contains");
    if (c) return { ...c, via: "contains" };
  }

  return null;
}

function aliasKind(norm: string): ResolvedOccupation["via"] {
  const hit = aliasIndex.get(norm);
  if (hit?.kind === "specialization") return "specialization";
  // Distinguish a canonical-label hit from an alias hit.
  for (const occ of occupations.values()) {
    if (normalizeLabel(occ.label) === norm) return "label";
  }
  return "alias";
}

/**
 * Resolves a label to an industry or sector (used to derive a person's
 * industries when the occupation itself did not resolve). Returns the
 * industry id, or null.
 */
export function resolveIndustry(raw: string): Industry | null {
  const hit = aliasIndex.get(normalizeLabel(raw));
  if (hit?.kind === "industry") return industries.get(hit.id) ?? null;
  return null;
}
