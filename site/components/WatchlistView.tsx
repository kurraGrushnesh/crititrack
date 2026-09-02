"use client";

import Link from "next/link";
import { DEMO_PROFILES } from "@/lib/demo-data";
import {
  computeControversyIndex,
  roundedScore,
} from "@/lib/controversy-index";
import { corroborated } from "@/lib/controversy";
import { useWatchlist } from "./watchlist-store";

/**
 * The device-local watchlist. Reads slugs from the external store and
 * shows the matching demo profiles with their current index and
 * sentiment. Nothing here touches the network.
 */
export default function WatchlistView() {
  const slugs = useWatchlist();
  const profiles = DEMO_PROFILES.filter((p) => slugs.includes(p.slug));

  if (profiles.length === 0) {
    return (
      <p className="no-records">
        Your watchlist is empty. Open a profile from{" "}
        <Link href="/explore">Explore</Link> and choose &ldquo;Watch&rdquo;.
      </p>
    );
  }

  return (
    <div className="profile-grid">
      {profiles.map((p) => {
        const index = computeControversyIndex(corroborated(p.controversies));
        return (
          <Link
            key={p.slug}
            href={`/profile/${p.slug}`}
            className="profile-card"
          >
            <span className="pc-role">{p.profession}</span>
            <span className="pc-name">{p.name}</span>
            <div className="pc-metrics">
              <span className="metric">
                <span className="m-value">{roundedScore(index)}</span>
                <span className="m-label">Index</span>
              </span>
              <span className="metric">
                <span className="m-value">{p.sentimentScore}</span>
                <span className="m-label">Sentiment</span>
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
