"use client";

import { useEffect, useState } from "react";
import { fetchTrending } from "@/lib/api";
import type { TrendingFigure } from "@/lib/trending";
import { sentimentColorVar } from "@/lib/sentiment";

/**
 * The most-looked-up figures on this deployment, from `GET /trending`.
 *
 * Honest by construction: it ranks what people here actually searched
 * for, not a hand-picked list. A fresh deployment — or a sleeping
 * backend — yields nothing, and the rail simply does not render. It
 * makes one unauthenticated request and never blocks the page.
 */
export default function TrendingRail({ limit = 8 }: { limit?: number }) {
  const [figures, setFigures] = useState<TrendingFigure[] | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchTrending({ limit, signal: ctrl.signal })
      .then(setFigures)
      .catch(() => setFigures([]));
    return () => ctrl.abort();
  }, [limit]);

  // Nothing to show (yet), or still loading: render nothing rather than a
  // skeleton for a section that is purely additive.
  if (!figures || figures.length === 0) return null;

  return (
    <section className="min-section" aria-labelledby="trending-h">
      <div className="head">
        <h2 id="trending-h">Most searched here</h2>
      </div>
      <p className="sub" style={{ marginBottom: 24 }}>
        Ranked by how often people on this site have looked each figure up.
      </p>
      <div className="trending-rail">
        {figures.map((f, i) => (
          <a
            key={f.slug}
            className="trending-card"
            href={`/figure/?q=${encodeURIComponent(f.name)}`}
          >
            <span className="trending-rank">#{i + 1}</span>
            <span className="trending-name">{f.name}</span>
            <span className="trending-meta">
              {f.sentimentScore != null ? (
                <>
                  sentiment{" "}
                  <b style={{ color: sentimentColorVar(f.sentimentScore) }}>
                    {Math.round(f.sentimentScore)}
                  </b>
                </>
              ) : (
                "not yet scored"
              )}{" "}
              · {f.requestCount} look-up{f.requestCount === 1 ? "" : "s"}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
