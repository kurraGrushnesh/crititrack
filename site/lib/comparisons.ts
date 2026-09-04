/**
 * Pure logic for saved comparisons — named sets of figures a reader
 * returns to, like "2024 election candidates" or "streaming CEOs". The
 * React store that persists this to localStorage is thin; this file holds
 * the parsing and the set operations the tests exercise.
 *
 * A comparison is intentionally just an ordered list of figure
 * references. The comparison screen re-fetches each figure live, so
 * nothing here caches profile data that could go stale.
 */

export interface ComparisonMember {
  slug: string;
  name: string;
}

export interface SavedComparison {
  id: string;
  label: string;
  members: ComparisonMember[];
}

/** The comparison screen overlays trajectories; beyond this it is noise. */
export const MAX_MEMBERS = 6;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function parseMember(v: unknown): ComparisonMember | null {
  if (!isRecord(v)) return null;
  const slug = typeof v.slug === "string" ? v.slug.trim() : "";
  if (!slug) return null;
  return {
    slug,
    name: typeof v.name === "string" && v.name ? v.name : slug,
  };
}

/** Dedupes members by slug, preserving first-seen order, capped. */
function normalizeMembers(members: ComparisonMember[]): ComparisonMember[] {
  const seen = new Set<string>();
  const out: ComparisonMember[] = [];
  for (const m of members) {
    if (seen.has(m.slug)) continue;
    seen.add(m.slug);
    out.push(m);
    if (out.length >= MAX_MEMBERS) break;
  }
  return out;
}

/** Parses stored JSON into a clean list, dropping malformed entries. */
export function parseComparisons(raw: string | null): SavedComparison[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((v): SavedComparison | null => {
      if (!isRecord(v)) return null;
      const id = typeof v.id === "string" && v.id ? v.id : "";
      const label = typeof v.label === "string" ? v.label.trim() : "";
      if (!id || !label) return null;
      const members = normalizeMembers(
        (Array.isArray(v.members) ? v.members : [])
          .map(parseMember)
          .filter((m): m is ComparisonMember => m !== null),
      );
      if (members.length < 2) return null;
      return { id, label, members };
    })
    .filter((c): c is SavedComparison => c !== null);
}

/** A stable-ish id without pulling in a uuid dependency. */
export function comparisonId(now = Date.now()): string {
  return `cmp_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Adds a comparison, or replaces one with the same (case-insensitive,
 * trimmed) label so re-saving under a name you already used updates it.
 * Returns the new list; the input is not mutated.
 */
export function upsertComparison(
  list: SavedComparison[],
  comparison: SavedComparison,
): SavedComparison[] {
  const members = normalizeMembers(comparison.members);
  if (members.length < 2) return list;
  const clean = { ...comparison, label: comparison.label.trim(), members };
  const key = clean.label.toLowerCase();
  const without = list.filter(
    (c) => c.id !== clean.id && c.label.toLowerCase() !== key,
  );
  return [...without, clean];
}

export function removeComparison(
  list: SavedComparison[],
  id: string,
): SavedComparison[] {
  return list.filter((c) => c.id !== id);
}

export function renameComparison(
  list: SavedComparison[],
  id: string,
  label: string,
): SavedComparison[] {
  const trimmed = label.trim();
  if (!trimmed) return list;
  return list.map((c) => (c.id === id ? { ...c, label: trimmed } : c));
}

/** The `?figures=a,b,c` query the compare screen reads, for a saved set. */
export function comparisonToQuery(comparison: SavedComparison): string {
  return comparison.members.map((m) => m.slug).join(",");
}
