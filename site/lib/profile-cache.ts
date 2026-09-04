/**
 * A small, persistent last-seen-profiles cache in localStorage.
 *
 * The in-memory cache in `use-celebrity.ts` is per-session; this survives
 * a reload and a period offline, so a reader who opened a profile
 * yesterday on a train sees it again today without a connection. It is a
 * convenience, never a source of truth: entries are stamped, the UI shows
 * "cached <when>", and a live fetch always replaces one.
 *
 * Storage is injectable so the logic is testable without a browser. Every
 * access is guarded — a private window or a storage-blocked browser makes
 * this a no-op, not an error.
 */

import type { RealProfile } from "./api";

const KEY = "crititrack.profileCache.v1";

/** Keep the last N profiles; a profile payload is a few KB. */
export const MAX_ENTRIES = 12;

export interface CachedProfile {
  slug: string;
  /** Epoch ms the profile was stored. */
  storedAt: number;
  profile: RealProfile;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readAll(store: StorageLike | null): CachedProfile[] {
  if (!store) return [];
  let raw: string | null;
  try {
    raw = store.getItem(KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is CachedProfile =>
        e &&
        typeof e === "object" &&
        typeof (e as CachedProfile).slug === "string" &&
        typeof (e as CachedProfile).storedAt === "number" &&
        !!(e as CachedProfile).profile,
    );
  } catch {
    return [];
  }
}

function writeAll(store: StorageLike | null, entries: CachedProfile[]): void {
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* quota or blocked; the cache just will not persist */
  }
}

/** The cached profile for `slug`, or null. */
export function readCachedProfile(
  slug: string,
  store: StorageLike | null = browserStorage(),
): CachedProfile | null {
  return readAll(store).find((e) => e.slug === slug) ?? null;
}

/**
 * Stores `profile`, moving it to the front and evicting the oldest beyond
 * MAX_ENTRIES. Returns the new list (also for tests).
 */
export function writeCachedProfile(
  profile: RealProfile,
  store: StorageLike | null = browserStorage(),
  now = Date.now(),
): CachedProfile[] {
  if (!store || !profile.slug) return readAll(store);
  const entry: CachedProfile = { slug: profile.slug, storedAt: now, profile };
  const rest = readAll(store).filter((e) => e.slug !== profile.slug);
  const next = [entry, ...rest].slice(0, MAX_ENTRIES);
  writeAll(store, next);
  return next;
}

/** Slugs currently cached, most-recent first. */
export function cachedProfileSlugs(
  store: StorageLike | null = browserStorage(),
): string[] {
  return readAll(store)
    .sort((a, b) => b.storedAt - a.storedAt)
    .map((e) => e.slug);
}
