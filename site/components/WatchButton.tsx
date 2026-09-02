"use client";

import { useWatchlist, toggleWatch, isWatched } from "./watchlist-store";

/**
 * Adds or removes a figure from the device-local watchlist. The list is
 * never sent anywhere; see `watchlist-store.ts`.
 */
export default function WatchButton({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const watching = isWatched(useWatchlist(), slug);
  return (
    <button
      type="button"
      className="watch-toggle"
      aria-pressed={watching}
      onClick={() => toggleWatch(slug, name)}
    >
      {watching ? `Watching ${name}` : `Watch ${name}`}
    </button>
  );
}
