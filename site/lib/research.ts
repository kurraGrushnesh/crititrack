/**
 * Research Workspace — the structured collection layer that turns
 * CritiTrack from "search and read" into "search → investigate →
 * collect evidence → analyze → organize". It does not compute anything
 * new: every item is a reference to something another system already
 * produced (an `EvidenceItem`, a `Claim`, a `Controversy`, a
 * `ChangeEvent`, a `TimelineEvent`, a resolved entity) plus the user's
 * own annotation (a note, a tag, an include/exclude/needs-review
 * decision). None of that annotation ever writes back to, or is
 * presented as, the authoritative record it references.
 *
 * This module is pure and storage-agnostic: it has no Firestore, no
 * `fetch`, no `Date.now()` baked into its exports (every function that
 * needs "now" takes it as a parameter). `site/lib/research-store.ts`
 * wires this to the actual Firestore-backed persistence
 * (`users/{uid}/researchWorkspaces/{workspaceId}`); this file is what
 * is unit-tested.
 *
 * CritiTrack has no real user-account system on the web today — only
 * silent anonymous Firebase sign-in (see `lib/firebase.ts`). A
 * workspace is therefore private to one anonymous uid, which in
 * practice means one browser profile: it does not follow a person to a
 * different browser or device, because there is no account to follow.
 * That is the same limitation the existing Watchlist already has, and
 * it is disclosed in the UI, not hidden.
 */

export const RESEARCH_METHODOLOGY_VERSION = "research-1";

// ── Workspace ─────────────────────────────────────────────────────────

export type WorkspaceStatus = "ACTIVE" | "ARCHIVED";

export interface ResearchWorkspace {
  workspaceId: string;
  userId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  /** Resolved entities this workspace is about. An entity can appear
   * here with zero items yet (added but nothing collected). */
  entityIds: string[];
  status: WorkspaceStatus;
  tags: string[];
  lastOpenedAt: string | null;
}

function titleForEntities(names: string[]): string {
  if (names.length === 0) return "Untitled research";
  if (names.length === 1) return `Research — ${names[0]}`;
  if (names.length === 2) return `Compare ${names[0]} and ${names[1]}`;
  return `Research — ${names.join(", ")}`;
}

/** Creates a new workspace object. The store layer supplies `workspaceId`
 * (a Firestore-generated id) — this function stays pure and testable. */
export function createWorkspace(input: {
  workspaceId: string;
  userId: string;
  entityIds?: string[];
  entityNames?: string[];
  title?: string;
  description?: string;
  now: string;
}): ResearchWorkspace {
  const entityIds = input.entityIds ?? [];
  return {
    workspaceId: input.workspaceId,
    userId: input.userId,
    title: input.title?.trim() || titleForEntities(input.entityNames ?? []),
    description: input.description?.trim() ?? "",
    createdAt: input.now,
    updatedAt: input.now,
    entityIds,
    status: "ACTIVE",
    tags: [],
    lastOpenedAt: input.now,
  };
}

export function renameWorkspace(w: ResearchWorkspace, title: string, now: string): ResearchWorkspace {
  const trimmed = title.trim();
  if (!trimmed) return w;
  return { ...w, title: trimmed, updatedAt: now };
}

export function updateDescription(w: ResearchWorkspace, description: string, now: string): ResearchWorkspace {
  return { ...w, description: description.trim(), updatedAt: now };
}

export function setWorkspaceStatus(w: ResearchWorkspace, status: WorkspaceStatus, now: string): ResearchWorkspace {
  if (w.status === status) return w;
  return { ...w, status, updatedAt: now };
}

export function archiveWorkspace(w: ResearchWorkspace, now: string): ResearchWorkspace {
  return setWorkspaceStatus(w, "ARCHIVED", now);
}

export function reactivateWorkspace(w: ResearchWorkspace, now: string): ResearchWorkspace {
  return setWorkspaceStatus(w, "ACTIVE", now);
}

export function markOpened(w: ResearchWorkspace, now: string): ResearchWorkspace {
  return { ...w, lastOpenedAt: now };
}

export function addEntityToWorkspace(w: ResearchWorkspace, entityId: string, now: string): ResearchWorkspace {
  if (w.entityIds.includes(entityId)) return w;
  return { ...w, entityIds: [...w.entityIds, entityId], updatedAt: now };
}

export function removeEntityFromWorkspace(w: ResearchWorkspace, entityId: string, now: string): ResearchWorkspace {
  if (!w.entityIds.includes(entityId)) return w;
  return { ...w, entityIds: w.entityIds.filter((id) => id !== entityId), updatedAt: now };
}

// ── Items ───────────────────────────────────────────────────────────

export type ResearchItemType =
  | "ENTITY"
  | "EVIDENCE"
  | "CLAIM"
  | "CONTROVERSY"
  | "NEWS_EVENT"
  | "TIMELINE_EVENT"
  | "CHANGE_EVENT"
  | "HISTORICAL_EVENT"
  | "RELATIONSHIP"
  | "SOURCE"
  | "NOTE";

/** A workspace-level decision, distinct from — and never overwriting —
 * CritiTrack's own verification/coverage/confidence state. */
export type FindingStatus = "UNDECIDED" | "INCLUDED" | "EXCLUDED" | "NEEDS_REVIEW";

export interface ResearchItem {
  itemId: string;
  workspaceId: string;
  type: ResearchItemType;
  /** The resolved entity this item is about, when applicable. Null for
   * a freestanding NOTE not tied to any entity. */
  entityId: string | null;
  title: string;
  summary: string;
  /** Stable id of the canonical record this item points to (an
   * `evidenceId`, `claimId`, a computed controversy/timeline/change key,
   * a source URL) — never a copy of that record. Null for a
   * freestanding NOTE. */
  referenceId: string | null;
  addedAt: string;
  updatedAt: string;
  /** The user's own research note on this item — always rendered as
   * "Research note", never as a fact. */
  note: string;
  tags: string[];
  /** Manual ordering within a section; lower sorts first when the user
   * has reordered items. Sort-by-newest/oldest ignores this. */
  position: number;
  status: FindingStatus;
  /** A shallow, disclosed snapshot of whatever fields the canonical
   * record carried at add-time (e.g. an evidence item's confidence and
   * corroboration state, a claim's status and evidence count). Never
   * re-synced automatically — the workspace says what it knew when the
   * item was saved, not a live mirror. */
  metadata: Record<string, string | number | boolean | null>;
}

/** The identity Firestore uses as a document id for de-duplication: the
 * same canonical reference added twice becomes one item whose metadata
 * is refreshed, per spec — never a second row. A NOTE has no reference,
 * so it always gets its own id (supplied by the caller/store). */
export function stableItemKey(type: ResearchItemType, referenceId: string | null): string | null {
  if (referenceId == null) return null;
  return `${type}:${referenceId}`;
}

export interface AddItemInput {
  itemId: string;
  workspaceId: string;
  type: ResearchItemType;
  entityId?: string | null;
  title: string;
  summary?: string;
  referenceId?: string | null;
  note?: string;
  tags?: string[];
  metadata?: Record<string, string | number | boolean | null>;
  now: string;
}

export function buildItem(input: AddItemInput): ResearchItem {
  return {
    itemId: input.itemId,
    workspaceId: input.workspaceId,
    type: input.type,
    entityId: input.entityId ?? null,
    title: input.title,
    summary: input.summary ?? "",
    referenceId: input.referenceId ?? null,
    addedAt: input.now,
    updatedAt: input.now,
    note: input.note ?? "",
    tags: normalizeTags(input.tags ?? []),
    position: 0,
    status: "UNDECIDED",
    metadata: input.metadata ?? {},
  };
}

/** Adds an item to a list, enforcing "the same reference is never
 * accidentally duplicated": if an item with the same (type, referenceId)
 * already exists, its metadata/title/summary are refreshed in place
 * (position and user annotations — note, tags, status — are preserved)
 * rather than inserting a second row. */
export function addItem(
  items: ResearchItem[],
  next: ResearchItem,
): { items: ResearchItem[]; added: boolean } {
  const key = stableItemKey(next.type, next.referenceId);
  if (key != null) {
    const existingIndex = items.findIndex((i) => stableItemKey(i.type, i.referenceId) === key);
    if (existingIndex !== -1) {
      const existing = items[existingIndex];
      const merged: ResearchItem = {
        ...existing,
        title: next.title,
        summary: next.summary,
        entityId: next.entityId ?? existing.entityId,
        metadata: next.metadata,
        updatedAt: next.updatedAt,
      };
      const out = [...items];
      out[existingIndex] = merged;
      return { items: out, added: false };
    }
  }
  return { items: [...items, next], added: true };
}

export function removeItem(items: ResearchItem[], itemId: string): ResearchItem[] {
  return items.filter((i) => i.itemId !== itemId);
}

export function setItemStatus(items: ResearchItem[], itemId: string, status: FindingStatus, now: string): ResearchItem[] {
  return items.map((i) => (i.itemId === itemId ? { ...i, status, updatedAt: now } : i));
}

export function setItemNote(items: ResearchItem[], itemId: string, note: string, now: string): ResearchItem[] {
  return items.map((i) => (i.itemId === itemId ? { ...i, note, updatedAt: now } : i));
}

export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const trimmed = t.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function addTag(items: ResearchItem[], itemId: string, tag: string, now: string): ResearchItem[] {
  return items.map((i) =>
    i.itemId === itemId ? { ...i, tags: normalizeTags([...i.tags, tag]), updatedAt: now } : i,
  );
}

export function removeTag(items: ResearchItem[], itemId: string, tag: string, now: string): ResearchItem[] {
  const key = tag.trim().toLowerCase();
  return items.map((i) =>
    i.itemId === itemId ? { ...i, tags: i.tags.filter((t) => t.toLowerCase() !== key), updatedAt: now } : i,
  );
}

// ── Freestanding notes ─────────────────────────────────────────────

export const NOTE_TAGS = ["follow-up", "important", "question", "context"] as const;

export function createNoteItem(input: {
  itemId: string;
  workspaceId: string;
  entityId?: string | null;
  text: string;
  tags?: string[];
  now: string;
}): ResearchItem {
  return buildItem({
    itemId: input.itemId,
    workspaceId: input.workspaceId,
    type: "NOTE",
    entityId: input.entityId ?? null,
    title: "Research note",
    note: input.text,
    tags: input.tags,
    referenceId: null,
    now: input.now,
  });
}

// ── Search / filter / sort ──────────────────────────────────────────

export function searchItems(items: ResearchItem[], query: string): ResearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((i) =>
    [i.title, i.summary, i.note, ...i.tags].some((f) => f.toLowerCase().includes(q)),
  );
}

export function filterByType(items: ResearchItem[], type: ResearchItemType | "ALL"): ResearchItem[] {
  if (type === "ALL") return items;
  return items.filter((i) => i.type === type);
}

export function filterByEntity(items: ResearchItem[], entityId: string | "ALL"): ResearchItem[] {
  if (entityId === "ALL") return items;
  return items.filter((i) => i.entityId === entityId);
}

export type ItemSort = "newest" | "oldest" | "position";

export function sortItems(items: ResearchItem[], sort: ItemSort): ResearchItem[] {
  const out = [...items];
  if (sort === "newest") out.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  else if (sort === "oldest") out.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  else out.sort((a, b) => a.position - b.position);
  return out;
}

// ── Overview ─────────────────────────────────────────────────────────

export interface WorkspaceOverviewCounts {
  entities: number;
  evidence: number;
  claims: number;
  events: number;
  sources: number;
  notes: number;
}

export function overviewCounts(items: ResearchItem[]): WorkspaceOverviewCounts {
  const count = (t: ResearchItemType) => items.filter((i) => i.type === t).length;
  return {
    entities: count("ENTITY"),
    evidence: count("EVIDENCE"),
    claims: count("CLAIM"),
    events: count("CONTROVERSY") + count("NEWS_EVENT") + count("TIMELINE_EVENT") + count("CHANGE_EVENT") + count("HISTORICAL_EVENT"),
    sources: count("SOURCE"),
    notes: count("NOTE"),
  };
}

// ── Evidence quality view ────────────────────────────────────────────

/** Reads `metadata.confidence` off saved EVIDENCE items (values
 * "high"/"medium"/"low", matching `EvidenceStrength`) and
 * `metadata.corroborated`/`metadata.status` off saved CLAIM items.
 * Never computes a new confidence — only counts what was already there
 * when each item was saved. */
export interface EvidenceQualitySummary {
  evidenceCollected: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  corroboratedClaims: number;
  claimsNeedingReview: number;
}

export function evidenceQualitySummary(items: ResearchItem[]): EvidenceQualitySummary {
  const evidence = items.filter((i) => i.type === "EVIDENCE");
  const claims = items.filter((i) => i.type === "CLAIM");
  const confidenceOf = (i: ResearchItem): string => String(i.metadata.confidence ?? "").toLowerCase();
  return {
    evidenceCollected: evidence.length,
    highConfidence: evidence.filter((i) => confidenceOf(i) === "high" || confidenceOf(i) === "strong").length,
    mediumConfidence: evidence.filter((i) => confidenceOf(i) === "medium").length,
    lowConfidence: evidence.filter((i) => confidenceOf(i) === "low" || confidenceOf(i) === "weak").length,
    corroboratedClaims: claims.filter((i) => i.metadata.corroborated === true).length,
    claimsNeedingReview: items.filter((i) => i.status === "NEEDS_REVIEW").length,
  };
}

// ── Activity log ─────────────────────────────────────────────────────

export type ActivityKind =
  | "workspace_created"
  | "item_added"
  | "item_removed"
  | "note_added"
  | "note_edited"
  | "tag_changed"
  | "status_changed";

export interface ActivityEntry {
  activityId: string;
  workspaceId: string;
  kind: ActivityKind;
  summary: string;
  at: string;
}

export function recordActivity(input: {
  activityId: string;
  workspaceId: string;
  kind: ActivityKind;
  summary: string;
  now: string;
}): ActivityEntry {
  return {
    activityId: input.activityId,
    workspaceId: input.workspaceId,
    kind: input.kind,
    summary: input.summary,
    at: input.now,
  };
}

/** Groups activity into "Today" / "Yesterday" / a date label, newest
 * first — display grouping only, never a claim about entity history. */
export function groupActivityByDay(entries: ActivityEntry[], now: Date = new Date()): { label: string; entries: ActivityEntry[] }[] {
  const todayKey = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);

  const sorted = [...entries].sort((a, b) => b.at.localeCompare(a.at));
  const groups = new Map<string, ActivityEntry[]>();
  for (const e of sorted) {
    const day = e.at.slice(0, 10);
    const label = day === todayKey ? "Today" : day === yesterday ? "Yesterday" : day;
    const bucket = groups.get(label) ?? [];
    bucket.push(e);
    groups.set(label, bucket);
  }
  return [...groups.entries()].map(([label, list]) => ({ label, entries: list }));
}
