"use client";

import { useWatchlist, toggleWatch, isWatched } from "./watchlist-store";

/**
 * Adds or removes a figure from the device-local watchlist. The list is
 * never sent anywhere; see `watchlist-store.ts`.
 */
export default function WatchButton({
  slug,
  name,
  wikidataId,
}: {
  slug: string;
  name: string;
  /** Recorded on the watch entry when starting a new watch, so Watch
   * Intelligence has the truer stable id alongside the slug. Optional —
   * watching still works for any resolved profile without one. */
  wikidataId?: string;
}) {
  const watching = isWatched(useWatchlist(), slug);
  return (
    <button
      type="button"
      className="watch-toggle"
      aria-pressed={watching}
      onClick={() => toggleWatch(slug, name, wikidataId)}
    >
      {watching ? `Watching ${name}` : `Watch ${name}`}
    </button>
  );
}
