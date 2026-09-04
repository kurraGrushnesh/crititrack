"use client";

import { useSyncExternalStore } from "react";
import {
  parseComparisons,
  upsertComparison,
  removeComparison,
  renameComparison,
  comparisonId,
  type SavedComparison,
  type ComparisonMember,
} from "@/lib/comparisons";

/**
 * Device-local saved comparisons, backed by localStorage. Mirrors
 * `watchlist-store.ts`: an external store read during render with
 * `useSyncExternalStore`, snapshot cached and only replaced on change,
 * no network.
 */

const KEY = "crititrack.comparisons";
const EVENT = "crititrack:comparisons";

export type { SavedComparison, ComparisonMember };

let cache: SavedComparison[] = [];
let cacheKey = " ";

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): SavedComparison[] {
  const raw = readRaw() ?? "[]";
  if (raw !== cacheKey) {
    cacheKey = raw;
    cache = parseComparisons(raw);
  }
  return cache;
}

function getServerSnapshot(): SavedComparison[] {
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

export function useComparisons(): SavedComparison[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function commit(next: SavedComparison[]): void {
  const serialised = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, serialised);
  } catch {
    /* storage unavailable */
  }
  cacheKey = serialised;
  cache = next;
  window.dispatchEvent(new Event(EVENT));
}

export function saveComparison(label: string, members: ComparisonMember[]): void {
  commit(
    upsertComparison(getSnapshot(), {
      id: comparisonId(),
      label,
      members,
    }),
  );
}

export function deleteComparison(id: string): void {
  commit(removeComparison(getSnapshot(), id));
}

export function renameSavedComparison(id: string, label: string): void {
  commit(renameComparison(getSnapshot(), id, label));
}
