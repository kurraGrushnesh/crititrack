"use client";

import { useState } from "react";
import { DEMO_PROFILES, demoProfileBySlug } from "@/lib/demo-data";
import { computeControversyIndex, roundedScore } from "@/lib/controversy-index";
import { corroborated } from "@/lib/controversy";
import SentimentTrend from "./SentimentTrend";

/**
 * Side-by-side comparison of two profiles. Both columns are scored by
 * the same deterministic index and the same sentiment bands, so the
 * comparison is like-for-like.
 */
export default function CompareView() {
  const [left, setLeft] = useState(DEMO_PROFILES[0]?.slug ?? "");
  const [right, setRight] = useState(DEMO_PROFILES[1]?.slug ?? "");

  const a = demoProfileBySlug(left);
  const b = demoProfileBySlug(right);

  return (
    <>
      <div className="compare-pickers">
        <label className="field">
          <span>Left</span>
          <select value={left} onChange={(e) => setLeft(e.target.value)}>
            {DEMO_PROFILES.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Right</span>
          <select value={right} onChange={(e) => setRight(e.target.value)}>
            {DEMO_PROFILES.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="compare-cols">
        {[a, b].map((p, i) =>
          p == null ? (
            <p key={i} className="no-records">
              Pick a profile.
            </p>
          ) : (
            <ComparePanel key={p.slug} slug={p.slug} />
          ),
        )}
      </div>
    </>
  );
}

function ComparePanel({ slug }: { slug: string }) {
  const p = demoProfileBySlug(slug);
  if (!p) return null;
  const kept = corroborated(p.controversies);
  const index = computeControversyIndex(kept);
  return (
    <div className="record">
      <div className="record-top">
        <h3>{p.name}</h3>
        <span className="tag">{p.profession}</span>
      </div>
      <dl className="detail-rows">
        <div>
          <dt>Controversy Index</dt>
          <dd>
            {roundedScore(index)} / 100 &nbsp;&middot;&nbsp; {index.label}
          </dd>
        </div>
        <div>
          <dt>Documented episodes</dt>
          <dd>
            {index.total} (peak severity {index.peakSeverity},{" "}
            {index.ongoingCount} unresolved)
          </dd>
        </div>
        <div>
          <dt>Dropped by the gate</dt>
          <dd>{p.controversies.length - kept.length}</dd>
        </div>
        <div>
          <dt>Sentiment</dt>
          <dd>
            <SentimentTrend
              points={p.trend}
              current={p.sentimentScore}
              direction={p.trendDirection}
            />
          </dd>
        </div>
      </dl>
      <p className="form-note">
        <a href={`/profile/${p.slug}`}>Open the full profile</a>
      </p>
    </div>
  );
}
