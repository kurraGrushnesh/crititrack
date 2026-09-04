"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DEMO_PROFILES, demoProfileBySlug } from "@/lib/demo-data";
import {
  computeControversyIndex,
  roundedScore,
  scoreBand,
} from "@/lib/controversy-index";
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

  // No default pair — the reader chooses both. Only a shared
  // `?figures=a,b` link pre-fills the selects.
  const picked = parseComparisonQuery(params.get("figures"));
  const left = picked[0] ?? "";
  const right = picked[1] ?? "";

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
            <option value="">Select a profile</option>
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
            <option value="">Select a profile</option>
            {DEMO_PROFILES.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ScoreDifference left={left} right={right} />

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

/**
 * The gap between the two CritiScores, shown once above both columns
 * rather than repeated per card. Deliberately neutral: it states the
 * difference in points, never that one person is "worse" — the score is
 * a documented-episode count, not a verdict.
 */
function ScoreDifference({ left, right }: { left: string; right: string }) {
  const l = demoProfileBySlug(left);
  const r = demoProfileBySlug(right);
  if (!l || !r) return null;

  const li = computeControversyIndex(corroborated(l.controversies));
  const ri = computeControversyIndex(corroborated(r.controversies));
  const diff = Math.abs(roundedScore(li) - roundedScore(ri));

  return (
    <p className="compare-diff">
      {l.name} <strong>{roundedScore(li)}</strong> ({scoreBand(li.score).band}) vs.{" "}
      {r.name} <strong>{roundedScore(ri)}</strong> ({scoreBand(ri.score).band}) —{" "}
      a {diff}-point difference in documented episodes, not a ranking of the
      two people.
    </p>
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
            {roundedScore(index)} / 100 &nbsp;&middot;&nbsp;{" "}
            <span className="tag">{scoreBand(index.score).band}</span>
            &nbsp;&middot;&nbsp; {index.label}
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
