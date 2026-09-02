"use client";

import Link from "next/link";
import { demoProfileBySlug } from "@/lib/demo-data";
import { useWatchlist, toggleWatch } from "./watchlist-store";

/**
 * The device-local watchlist. Reads `{ slug, name }` entries from the
 * external store. A real figure links to its live profile; one of the
 * three illustrative composites links to its static page. Nothing here
 * touches the network.
 */
export default function WatchlistView() {
  const entries = useWatchlist();

  if (entries.length === 0) {
    return (
      <p className="no-records">
        Your watchlist is empty. Open a profile and choose
        &ldquo;Watch&rdquo; — it is stored only in this browser.
      </p>
    );
  }

  return (
    <div className="person-grid">
      {entries.map((e) => {
        const demo = demoProfileBySlug(e.slug);
        const href = demo
          ? `/profile/${e.slug}`
          : `/figure/?q=${encodeURIComponent(e.name)}`;
        return (
          <div key={e.slug} className="watch-card">
            <Link href={href} className="person-card">
              <span className="pc-name">{e.name}</span>
              <span className="pc-desc">
                {demo ? `${demo.profession} · illustrative` : "Live profile"}
              </span>
            </Link>
            <button
              type="button"
              className="watch-remove"
              onClick={() => toggleWatch(e.slug, e.name)}
              aria-label={`Remove ${e.name} from watchlist`}
            >
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}
