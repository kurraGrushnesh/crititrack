/**
 * Pure watchlist logic — parsing, membership, toggling. The React store
 * that wires this to localStorage lives in
 * `components/watchlist-store.ts`; this file is what the tests exercise.
 */

export interface WatchEntry {
  slug: string;
  name: string;
}

/**
 * Parses stored JSON into entries, migrating the old bare-slug-array
 * format (`["taylor-swift"]`) to `{ slug, name }`. Malformed entries are
 * dropped rather than rendered.
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
      if (typeof v === "string") return { slug: v, name: v };
      if (
        v &&
        typeof v === "object" &&
        typeof (v as WatchEntry).slug === "string"
      ) {
        const e = v as WatchEntry;
        return {
          slug: e.slug,
          name: typeof e.name === "string" && e.name ? e.name : e.slug,
        };
      }
      return null;
    })
    .filter((e): e is WatchEntry => e !== null);
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
    : [...list, { slug, name }];
}
