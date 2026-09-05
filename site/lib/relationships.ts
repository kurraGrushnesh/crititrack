/**
 * Entity Relationship Intelligence — answers "how is Entity A connected
 * to Entity B according to available evidence?" using only data other
 * systems already retrieved. A relationship is only ever surfaced when
 * a real record documents it:
 *
 *   - a structured Wikidata claim (spouse, family, member-of, owns) —
 *     from `RealProfile.relationships`, extracted server-side in
 *     `functions/lib/entity.js`;
 *   - a dated Wikidata career row (employer, position held) — from
 *     `RealProfile.career.timeline`, which is already Wikidata-sourced.
 *
 * Nothing here is inferred from name similarity, a shared profession, a
 * shared country, or two people merely appearing in the same article.
 * News can only *corroborate* a relationship a record already
 * documents (raising its evidence count), never create one. There is no
 * model in this module — every field is a deterministic read of a
 * structured claim.
 *
 * The workspace/report side stores a reference to a `relationshipId`
 * plus the user's own note; it never edits the canonical relationship,
 * which is derived fresh from public data on every load.
 */

import type { RawRelationship } from "./api";
import type { CareerEntry } from "./career";
import type { EvidenceItem } from "./evidence";
import { titleSlug } from "./claims";

export const RELATIONSHIP_METHODOLOGY_VERSION = "relationships-1";

// ── Taxonomy ─────────────────────────────────────────────────────────

export type RelationshipCategory =
  | "PERSONAL"
  | "PROFESSIONAL"
  | "BUSINESS"
  | "ORGANIZATIONAL"
  | "MEDIA"
  | "SPORTS"
  | "OTHER";

export type RelationshipType =
  // PERSONAL
  | "FAMILY"
  | "SPOUSE"
  | "PARENT"
  | "CHILD"
  | "SIBLING"
  // PROFESSIONAL
  | "EMPLOYED_BY"
  | "LEADS"
  | "FOUNDED"
  | "COFOUNDED"
  | "BOARD_MEMBER_OF"
  | "ADVISOR_TO"
  | "REPRESENTED_BY"
  | "MANAGED_BY"
  | "AGENT_FOR"
  | "COLLABORATED_WITH"
  | "WORKED_WITH"
  // BUSINESS
  | "OWNS"
  | "INVESTED_IN"
  | "PARTNERED_WITH"
  | "EXECUTIVE_OF"
  | "DIRECTOR_OF"
  // ORGANIZATIONAL
  | "MEMBER_OF"
  | "AFFILIATED_WITH"
  | "MEMBER_OF_TEAM"
  | "MEMBER_OF_PARTY_OR_GROUP"
  // MEDIA / CREATOR
  | "APPEARED_WITH"
  | "INTERVIEWED_BY"
  | "HOSTED_BY"
  | "CREATED_WITH"
  // SPORTS
  | "TEAMMATE_OF"
  | "COACH_OF"
  | "COACHED_BY"
  | "COMPETED_AGAINST"
  | "REPRESENTS_TEAM"
  // OTHER
  | "ENDORSED_BY"
  | "ENDORSES"
  | "UNKNOWN_DOCUMENTED";

export const RELATIONSHIP_TYPE_LABEL: Partial<Record<RelationshipType, string>> = {
  FAMILY: "Family",
  SPOUSE: "Spouse",
  PARENT: "Parent",
  CHILD: "Child",
  SIBLING: "Sibling",
  EMPLOYED_BY: "Employed by",
  LEADS: "Leads",
  FOUNDED: "Founded",
  BOARD_MEMBER_OF: "Board member of",
  MEMBER_OF: "Member of",
  OWNS: "Owns",
  UNKNOWN_DOCUMENTED: "Documented relationship",
};

export function relationshipTypeLabel(type: RelationshipType): string {
  return RELATIONSHIP_TYPE_LABEL[type] ?? type.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

const CATEGORY_OF: Partial<Record<RelationshipType, RelationshipCategory>> = {
  FAMILY: "PERSONAL",
  SPOUSE: "PERSONAL",
  PARENT: "PERSONAL",
  CHILD: "PERSONAL",
  SIBLING: "PERSONAL",
  EMPLOYED_BY: "PROFESSIONAL",
  LEADS: "PROFESSIONAL",
  FOUNDED: "PROFESSIONAL",
  BOARD_MEMBER_OF: "PROFESSIONAL",
  MEMBER_OF: "ORGANIZATIONAL",
  MEMBER_OF_TEAM: "SPORTS",
  MEMBER_OF_PARTY_OR_GROUP: "ORGANIZATIONAL",
  OWNS: "BUSINESS",
  EXECUTIVE_OF: "BUSINESS",
  DIRECTOR_OF: "BUSINESS",
};

export function categoryOf(type: RelationshipType): RelationshipCategory {
  return CATEGORY_OF[type] ?? "OTHER";
}

export type RelationshipStatus = "ACTIVE" | "HISTORICAL" | "ENDED" | "UNCERTAIN";
export type RelationshipDirection = "OUTGOING" | "INCOMING" | "BIDIRECTIONAL" | "UNKNOWN";
export type RelationshipConfidence = "HIGH" | "MEDIUM" | "LOW";
export type ObjectKind = "person" | "organization" | "team" | "group" | "other";

export interface EntityRelationship {
  relationshipId: string;
  subjectEntityId: string;
  subjectName: string;
  objectEntityId: string;
  objectName: string;
  objectKind: ObjectKind;
  relationshipType: RelationshipType;
  category: RelationshipCategory;
  direction: RelationshipDirection;
  status: RelationshipStatus;
  confidence: RelationshipConfidence;
  /** URLs of the records documenting this relationship. Always at least
   * one for a surfaced relationship — a relationship with no source is
   * never emitted. */
  sourceUrls: string[];
  evidenceIds: string[];
  claimIds: string[];
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  effectiveFrom: number | null;
  effectiveTo: number | null;
  methodologyVersion: string;
}

// ── Derivation ───────────────────────────────────────────────────────

function objectKindForType(type: RelationshipType): ObjectKind {
  if (["FAMILY", "SPOUSE", "PARENT", "CHILD", "SIBLING"].includes(type)) return "person";
  if (type === "MEMBER_OF_TEAM" || type === "TEAMMATE_OF" || type === "REPRESENTS_TEAM") return "team";
  if (type === "MEMBER_OF_PARTY_OR_GROUP") return "group";
  return "organization";
}

/** Maps a career role's own words to a professional relationship type.
 * Deterministic keyword match over the recorded role — never a guess
 * about seniority the record does not state. */
function typeForRole(role: string | null): RelationshipType {
  const r = (role ?? "").toLowerCase();
  if (/\bfound/.test(r)) return "FOUNDED";
  if (/\b(chair|board)\b/.test(r)) return "BOARD_MEMBER_OF";
  if (/\b(ceo|chief executive|president|managing director|director|head of|owner|partner)\b/.test(r)) return "LEADS";
  return "EMPLOYED_BY";
}

function statusFor(start: number | null, end: number | null, deceasedOrPersonal: boolean): RelationshipStatus {
  if (end != null) return "ENDED";
  if (start != null || deceasedOrPersonal) return "ACTIVE";
  return "ACTIVE"; // an undated structured claim is treated as current, not uncertain
}

function dedupeKey(r: Pick<EntityRelationship, "subjectEntityId" | "objectEntityId" | "relationshipType" | "effectiveFrom">): string {
  return `${r.subjectEntityId}|${r.objectEntityId}|${r.relationshipType}|${r.effectiveFrom ?? ""}`;
}

let counter = 0;
function nextId(subjectId: string, type: RelationshipType): string {
  counter += 1;
  return `${subjectId}-${type}-${counter}`;
}

/** Tests only — makes ids deterministic per run. */
export function resetRelationshipIdCounter(): void {
  counter = 0;
}

/**
 * Corroborating evidence for a relationship: retrieved items whose text
 * names *both* endpoints. This never creates a relationship — it only
 * attaches evidence ids to one a structured record already documents,
 * so the card can show "3 sources" and a reader can check.
 */
function corroboratingEvidence(items: EvidenceItem[], subjectName: string, objectName: string): string[] {
  const subj = subjectName.toLowerCase();
  const obj = objectName.toLowerCase();
  if (!subj || !obj || subj === obj) return [];
  return items
    .filter((i) => {
      const text = `${i.title} ${i.snippet ?? ""}`.toLowerCase();
      return text.includes(subj) && text.includes(obj);
    })
    .map((i) => i.evidenceId);
}

export function buildRelationships(input: {
  subjectEntityId: string;
  subjectName: string;
  wikidataRelationships: RawRelationship[];
  career: CareerEntry[];
  evidenceItems: EvidenceItem[];
}): EntityRelationship[] {
  const { subjectEntityId, subjectName, wikidataRelationships, career, evidenceItems } = input;
  const byKey = new Map<string, EntityRelationship>();

  const add = (r: EntityRelationship) => {
    const key = dedupeKey(r);
    const existing = byKey.get(key);
    if (existing) {
      // Same documented relationship from a second record: merge source
      // and evidence, keep the stronger status/confidence.
      existing.sourceUrls = [...new Set([...existing.sourceUrls, ...r.sourceUrls])];
      existing.evidenceIds = [...new Set([...existing.evidenceIds, ...r.evidenceIds])];
      if (r.effectiveTo != null && existing.effectiveTo == null) {
        existing.effectiveTo = r.effectiveTo;
        existing.status = "ENDED";
      }
      return;
    }
    byKey.set(key, r);
  };

  // 1. Structured Wikidata relationships (spouse / family / member-of / owns)
  for (const raw of wikidataRelationships) {
    if (!raw.targetId || !raw.targetLabel) continue;
    const type = raw.type as RelationshipType;
    const evidenceIds = corroboratingEvidence(evidenceItems, subjectName, raw.targetLabel);
    add({
      relationshipId: nextId(subjectEntityId, type),
      subjectEntityId,
      subjectName,
      objectEntityId: raw.targetId,
      objectName: raw.targetLabel,
      objectKind: objectKindForType(type),
      relationshipType: type,
      category: (raw.category as RelationshipCategory) ?? categoryOf(type),
      direction: (raw.direction as RelationshipDirection) ?? "UNKNOWN",
      status: statusFor(raw.start, raw.end, categoryOf(type) === "PERSONAL"),
      // A structured Wikidata claim is a strong source on its own;
      // corroborating retrieved coverage raises it no higher than HIGH.
      confidence: "HIGH",
      sourceUrls: raw.sourceUrl ? [raw.sourceUrl] : [],
      evidenceIds,
      claimIds: [],
      firstObservedAt: raw.start != null ? String(raw.start) : null,
      lastObservedAt: raw.end != null ? String(raw.end) : null,
      effectiveFrom: raw.start,
      effectiveTo: raw.end,
      methodologyVersion: RELATIONSHIP_METHODOLOGY_VERSION,
    });
  }

  // 2. Career-derived person→organization relationships (Wikidata-dated)
  for (const entry of career) {
    if (!entry.organization) continue;
    const type = typeForRole(entry.role);
    const objectEntityId = `org:${titleSlug(entry.organization)}`;
    const evidenceIds = corroboratingEvidence(evidenceItems, subjectName, entry.organization);
    add({
      relationshipId: nextId(subjectEntityId, type),
      subjectEntityId,
      subjectName,
      objectEntityId,
      objectName: entry.organization,
      objectKind: "organization",
      relationshipType: type,
      category: categoryOf(type),
      direction: "OUTGOING",
      status: statusFor(entry.start, entry.end, false),
      // Wikidata "position held" / "employer" is dated and sourced —
      // a HIGH-confidence record. A role with neither a date nor a
      // sourced entry drops to MEDIUM.
      confidence: entry.start != null || entry.end != null || entry.source.url ? "HIGH" : "MEDIUM",
      sourceUrls: entry.source.url ? [entry.source.url] : [],
      evidenceIds,
      claimIds: [],
      firstObservedAt: entry.start != null ? String(entry.start) : null,
      lastObservedAt: entry.end != null ? String(entry.end) : entry.current ? "present" : null,
      effectiveFrom: entry.start,
      effectiveTo: entry.end,
      methodologyVersion: RELATIONSHIP_METHODOLOGY_VERSION,
    });
  }

  // Only surface relationships that actually carry a source.
  return [...byKey.values()].filter((r) => r.sourceUrls.length > 0);
}

// ── Filter / search / coverage ──────────────────────────────────────

export type RelationshipTimeFilter = "current" | "1y" | "3y" | "5y" | "all";

export interface RelationshipFilters {
  category: RelationshipCategory | "ALL";
  status: RelationshipStatus | "ALL";
  confidence: RelationshipConfidence | "ALL";
  time: RelationshipTimeFilter;
}

export function defaultRelationshipFilters(): RelationshipFilters {
  return { category: "ALL", status: "ALL", confidence: "ALL", time: "all" };
}

export function filterRelationships(
  list: EntityRelationship[],
  filters: RelationshipFilters,
  currentYear = new Date().getFullYear(),
): EntityRelationship[] {
  return list.filter((r) => {
    if (filters.category !== "ALL" && r.category !== filters.category) return false;
    if (filters.status !== "ALL" && r.status !== filters.status) return false;
    if (filters.confidence !== "ALL" && r.confidence !== filters.confidence) return false;
    if (filters.time === "current" && r.status === "ENDED") return false;
    if (filters.time !== "all" && filters.time !== "current") {
      const years = { "1y": 1, "3y": 3, "5y": 5 }[filters.time];
      const end = r.effectiveTo ?? currentYear;
      if (currentYear - end > years) return false;
    }
    return true;
  });
}

export function searchRelationships(list: EntityRelationship[], query: string): EntityRelationship[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((r) =>
    [r.objectName, relationshipTypeLabel(r.relationshipType), r.category].some((f) => f.toLowerCase().includes(q)),
  );
}

export interface RelationshipCoverage {
  total: number;
  high: number;
  medium: number;
  low: number;
  supportingSources: number;
}

export function relationshipCoverage(list: EntityRelationship[]): RelationshipCoverage {
  const sources = new Set<string>();
  for (const r of list) for (const s of r.sourceUrls) sources.add(s);
  return {
    total: list.length,
    high: list.filter((r) => r.confidence === "HIGH").length,
    medium: list.filter((r) => r.confidence === "MEDIUM").length,
    low: list.filter((r) => r.confidence === "LOW").length,
    supportingSources: sources.size,
  };
}

// ── Advanced Compare helpers ────────────────────────────────────────

/** Direct documented relationships from A's own list whose object is B
 * — matched on the resolved object id, falling back to an exact
 * name match only when B has no resolvable id. */
export function directRelationshipsBetween(
  aRelationships: EntityRelationship[],
  bEntityId: string,
  bName: string,
): EntityRelationship[] {
  const name = bName.trim().toLowerCase();
  return aRelationships.filter(
    (r) => r.objectEntityId === bEntityId || (name.length > 0 && r.objectName.trim().toLowerCase() === name),
  );
}

export interface SharedConnection {
  organizationName: string;
  organizationId: string;
  aType: RelationshipType;
  bType: RelationshipType;
}

/** Organizations both entities have a documented relationship with.
 * This is NOT a direct relationship and is labeled "Shared
 * organization", never "connected". */
export function sharedConnections(
  aRelationships: EntityRelationship[],
  bRelationships: EntityRelationship[],
): SharedConnection[] {
  const bByOrg = new Map(bRelationships.filter((r) => r.objectKind === "organization").map((r) => [r.objectEntityId, r]));
  const out: SharedConnection[] = [];
  for (const a of aRelationships) {
    if (a.objectKind !== "organization") continue;
    const b = bByOrg.get(a.objectEntityId);
    if (!b) continue;
    out.push({ organizationName: a.objectName, organizationId: a.objectEntityId, aType: a.relationshipType, bType: b.relationshipType });
  }
  return out;
}

// ── Relationship change events (Step 16 RELATIONSHIP_CHANGE) ─────────

export interface RelationshipChange {
  changeId: string;
  entityId: string;
  changeType: "RELATIONSHIP_CHANGE";
  severity: "INFO" | "MINOR" | "SIGNIFICANT" | "MAJOR";
  title: string;
  summary: string;
  previousValue: string | null;
  currentValue: string | null;
  effectiveDate: string | null;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  methodologyVersion: string;
}

/** Compares two relationship snapshots of the same entity and emits a
 * RELATIONSHIP_CHANGE only when a documented relationship genuinely
 * appeared, ended, or changed type — never on a formatting difference,
 * and never when either snapshot is empty (a provider failure is not
 * the end of a relationship). */
export function relationshipChanges(
  entityId: string,
  previous: EntityRelationship[],
  current: EntityRelationship[],
  detectedAt: string,
): RelationshipChange[] {
  if (previous.length === 0 || current.length === 0) return [];
  const prevKeys = new Set(previous.map((r) => `${r.objectEntityId}|${r.relationshipType}`));
  const currKeys = new Set(current.map((r) => `${r.objectEntityId}|${r.relationshipType}`));
  const out: RelationshipChange[] = [];

  for (const r of current) {
    if (prevKeys.has(`${r.objectEntityId}|${r.relationshipType}`)) continue;
    out.push({
      changeId: `${entityId}-REL-NEW-${r.objectEntityId}-${r.relationshipType}`,
      entityId,
      changeType: "RELATIONSHIP_CHANGE",
      severity: r.category === "PROFESSIONAL" || r.category === "BUSINESS" ? "SIGNIFICANT" : "MINOR",
      title: `New documented relationship: ${relationshipTypeLabel(r.relationshipType)} ${r.objectName}`,
      summary: `A ${r.confidence.toLowerCase()}-confidence "${relationshipTypeLabel(r.relationshipType)}" relationship to ${r.objectName} is now documented.`,
      previousValue: null,
      currentValue: `${relationshipTypeLabel(r.relationshipType)} ${r.objectName}`,
      effectiveDate: r.firstObservedAt,
      confidence: r.confidence,
      methodologyVersion: RELATIONSHIP_METHODOLOGY_VERSION,
    });
  }

  for (const r of previous) {
    if (currKeys.has(`${r.objectEntityId}|${r.relationshipType}`)) continue;
    out.push({
      changeId: `${entityId}-REL-END-${r.objectEntityId}-${r.relationshipType}`,
      entityId,
      changeType: "RELATIONSHIP_CHANGE",
      severity: "MINOR",
      title: `Relationship no longer documented: ${relationshipTypeLabel(r.relationshipType)} ${r.objectName}`,
      summary: `The previously-documented "${relationshipTypeLabel(r.relationshipType)}" relationship to ${r.objectName} is no longer present in the available records.`,
      previousValue: `${relationshipTypeLabel(r.relationshipType)} ${r.objectName}`,
      currentValue: null,
      effectiveDate: detectedAt,
      confidence: "LOW",
      methodologyVersion: RELATIONSHIP_METHODOLOGY_VERSION,
    });
  }

  return out;
}
