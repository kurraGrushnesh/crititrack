/**
 * Pure watchlist logic — parsing, membership, toggling. The React store
 * that wires this to localStorage lives in
 * `components/watchlist-store.ts`; this file is what the tests exercise.
 */

export interface WatchEntry {
  slug: string;
  name: string;
  /**
   * Optional folder-like tags ("Politicians", "Watching closely"). Absent
   * on entries saved before tagging shipped; always present after a parse.
   */
  tags: string[];
}

/** Trims, dedupes and sorts a raw tag list. */
export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  for (const t of raw) {
    if (typeof t !== "string") continue;
    const clean = t.trim();
    if (clean) seen.add(clean);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * Parses stored JSON into entries, migrating the old bare-slug-array
 * format (`["taylor-swift"]`) to `{ slug, name, tags }`. Malformed
 * entries are dropped rather than rendered.
 */
export function parseWatchlist(raw: string | null): WatchEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((v): WatchEntry | null => {
      if (typeof v === "string") return { slug: v, name: v, tags: [] };
      if (
        v &&
        typeof v === "object" &&
        typeof (v as WatchEntry).slug === "string"
      ) {
        const e = v as Partial<WatchEntry> & { slug: string };
        return {
          slug: e.slug,
          name: typeof e.name === "string" && e.name ? e.name : e.slug,
          tags: normalizeTags(e.tags),
        };
      }
      return null;
    })
    .filter((e): e is WatchEntry => e !== null);
}

/** Every tag in use across the list, sorted. */
export function allTags(list: WatchEntry[]): string[] {
  return normalizeTags(list.flatMap((e) => e.tags));
}

/** The entries carrying `tag`; `null` tag means "untagged". */
export function entriesForTag(
  list: WatchEntry[],
  tag: string | null,
): WatchEntry[] {
  if (tag === null) return list.filter((e) => e.tags.length === 0);
  return list.filter((e) => e.tags.includes(tag));
}

/** Adds `tag` to one entry (no-op if absent or already tagged). */
export function addTag(
  list: WatchEntry[],
  slug: string,
  tag: string,
): WatchEntry[] {
  const clean = tag.trim();
  if (!clean) return list;
  return list.map((e) =>
    e.slug === slug && !e.tags.includes(clean)
      ? { ...e, tags: normalizeTags([...e.tags, clean]) }
      : e,
  );
}

/** Removes `tag` from one entry, or from all entries when `slug` is null. */
export function removeTag(
  list: WatchEntry[],
  slug: string | null,
  tag: string,
): WatchEntry[] {
  return list.map((e) =>
    (slug === null || e.slug === slug) && e.tags.includes(tag)
      ? { ...e, tags: e.tags.filter((t) => t !== tag) }
      : e,
  );
}

/** Renames a tag everywhere it appears. */
export function renameTag(
  list: WatchEntry[],
  from: string,
  to: string,
): WatchEntry[] {
  const target = to.trim();
  if (!target) return list;
  return list.map((e) =>
    e.tags.includes(from)
      ? { ...e, tags: normalizeTags(e.tags.map((t) => (t === from ? target : t))) }
      : e,
  );
}

export function isWatched(list: WatchEntry[], slug: string): boolean {
  return list.some((e) => e.slug === slug);
}

/** The list with `slug` added if absent, removed if present. */
export function toggledWatchlist(
  list: WatchEntry[],
  slug: string,
  name: string,
): WatchEntry[] {
  return isWatched(list, slug)
    ? list.filter((e) => e.slug !== slug)
    : [...list, { slug, name, tags: [] }];
}
