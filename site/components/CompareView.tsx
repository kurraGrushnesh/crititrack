"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEMO_PROFILES, demoProfileBySlug } from "@/lib/demo-data";
import { computeControversyIndex, roundedScore } from "@/lib/controversy-index";
import { corroborated } from "@/lib/controversy";
import { parseComparisonQuery } from "@/lib/deep-link";
import SentimentTrend from "./SentimentTrend";
import SavedComparisons from "./SavedComparisons";

/**
 * Side-by-side comparison of two profiles. Both columns are scored by
 * the same deterministic index and the same sentiment bands, so the
 * comparison is like-for-like.
 *
 * The current pair lives in the URL (`?figures=<left>,<right>`), so a
 * comparison is a shareable link and a saved comparison can reopen it.
 */
function CompareInner() {
  const params = useSearchParams();
  const router = useRouter();

  const picked = parseComparisonQuery(params.get("figures"));
  const left = picked[0] ?? DEMO_PROFILES[0]?.slug ?? "";
  const right = picked[1] ?? DEMO_PROFILES[1]?.slug ?? "";

  function setPair(nextLeft: string, nextRight: string) {
    const q = [nextLeft, nextRight].filter(Boolean).join(",");
    router.replace(q ? `/compare/?figures=${q}` : "/compare/", {
      scroll: false,
    });
  }

  return (
    <>
      <SavedComparisons current={[left, right]} />

      <div className="compare-pickers">
        <label className="field">
          <span>Left</span>
          <select value={left} onChange={(e) => setPair(e.target.value, right)}>
            {DEMO_PROFILES.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Right</span>
          <select value={right} onChange={(e) => setPair(left, e.target.value)}>
            {DEMO_PROFILES.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="compare-cols">
        {[left, right].map((slug, i) =>
          demoProfileBySlug(slug) == null ? (
            <p key={i} className="no-records">
              Pick a profile.
            </p>
          ) : (
            <ComparePanel key={slug} slug={slug} />
          ),
        )}
      </div>
    </>
  );
}

export default function CompareView() {
  return (
    <Suspense fallback={<p className="no-records">Loading…</p>}>
      <CompareInner />
    </Suspense>
  );
}

function ComparePanel({ slug }: { slug: string }) {
  const p = demoProfileBySlug(slug);
  const kept = useMemo(
    () => (p ? corroborated(p.controversies) : []),
    [p],
  );
  const index = useMemo(() => computeControversyIndex(kept), [kept]);
  if (!p) return null;
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
              label={p.name}
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
