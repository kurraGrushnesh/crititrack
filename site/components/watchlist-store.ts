"use client";

import { useSyncExternalStore } from "react";
import {
  parseWatchlist,
  isWatched,
  toggledWatchlist,
  addTag,
  removeTag,
  renameTag,
  type WatchEntry,
} from "@/lib/watchlist";

/**
 * A device-local watchlist, backed by localStorage.
 *
 * Each entry is `{ slug, name }` — the name is kept so a watched *real*
 * figure can be shown on the watchlist page and linked back to
 * `/figure/?q=<name>`. (The earlier version stored bare slugs, so a real
 * figure vanished from the list because only the three illustrative
 * composites could be resolved by slug.)
 *
 * Exposed as an external store so components read it during render with
 * `useSyncExternalStore`. The snapshot is cached and only replaced when
 * the contents change. Nothing here touches the network.
 */

const KEY = "crititrack.watchlist";
const EVENT = "crititrack:watchlist";

export type { WatchEntry };
export { isWatched };

let cache: WatchEntry[] = [];
let cacheKey = " "; // sentinel so the first read always recomputes

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): WatchEntry[] {
  const raw = readRaw() ?? "[]";
  if (raw !== cacheKey) {
    cacheKey = raw;
    cache = parseWatchlist(raw);
  }
  return cache;
}

function getServerSnapshot(): WatchEntry[] {
  return cache;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useWatchlist(): WatchEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function commit(next: WatchEntry[]): void {
  const serialised = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, serialised);
  } catch {
    /* storage unavailable; the change will not persist */
  }
  cacheKey = serialised;
  cache = next;
  window.dispatchEvent(new Event(EVENT));
}

export function toggleWatch(slug: string, name: string): void {
  commit(toggledWatchlist(getSnapshot(), slug, name));
}

/** Folder-like tags on a watched figure. */
export function tagWatch(slug: string, tag: string): void {
  commit(addTag(getSnapshot(), slug, tag));
}
export function untagWatch(slug: string | null, tag: string): void {
  commit(removeTag(getSnapshot(), slug, tag));
}
export function renameWatchTag(from: string, to: string): void {
  commit(renameTag(getSnapshot(), from, to));
}
