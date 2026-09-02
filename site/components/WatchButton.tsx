"use client";

import { useWatchlist, toggleWatch } from "./watchlist-store";

/**
 * Adds or removes a profile from the device-local watchlist. The list is
 * never sent anywhere; see `watchlist-store.ts`.
 */
export default function WatchButton({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const watching = useWatchlist().includes(slug);
  return (
    <button
      type="button"
      className="watch-toggle"
      aria-pressed={watching}
      onClick={() => toggleWatch(slug)}
    >
      {watching ? `Watching ${name}` : `Watch ${name}`}
    </button>
  );
}
