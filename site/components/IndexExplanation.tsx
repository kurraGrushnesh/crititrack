"use client";

import { useMemo } from "react";
import type { Controversy } from "@/lib/controversy";
import {
  explainControversyIndex,
  type IndexExplanationRow,
} from "@/lib/controversy-index";

/**
 * A collapsible "why this number" panel for the Controversy Index — one
 * breakdown card per episode rather than a table, so it reads on a phone
 * without a horizontal scroll. Every card shows the same arithmetic the
 * score is built from — severity, recency, unresolved status, evidence —
 * plus a plain sentence explaining why that episode moved the score the
 * amount it did. Nothing here is a model output.
 */
export default function IndexExplanation({
  controversies,
}: {
  controversies: Controversy[];
}) {
  const ex = useMemo(
    () => explainControversyIndex(controversies),
    [controversies],
  );
  const sourceCount = useMemo(
    () => new Map(controversies.map((c) => [c.title, c.sources.length])),
    [controversies],
  );

  if (ex.rows.length === 0) return null;

  return (
    <details className="ix-explain">
      <summary>How this score was computed</summary>
      <div className="ix-explain-body">
        <div className="ix-cards">
          {ex.rows.map((r, i) => (
            <EpisodeCard key={i} row={r} sources={sourceCount.get(r.title) ?? 0} />
          ))}
        </div>

        <p className="ix-total">
          Total weight <strong>{ex.totalWeight.toFixed(2)}</strong> →{" "}
          <strong>{ex.score.toFixed(1)}</strong> / 100
        </p>
        <p className="ix-curve">{ex.curve}</p>
        <p className="ix-gate-note">
          An allegation the retrieved coverage does not corroborate is
          dropped before it reaches this score — a severity 4 or 5 claim
          with no source never counts, however serious it would otherwise
          sound.
        </p>
      </div>
    </details>
  );
}

function reasonFor(r: IndexExplanationRow, sources: number): string {
  const parts: string[] = [`severity ${r.severity}/5`];
  parts.push(
    r.year != null
      ? r.recencyFactor >= 0.99
        ? `recent (${r.year})`
        : `older (${r.year})`
      : "undated (mildly discounted)",
  );
  if (r.ongoing) parts.push("unresolved (weighted up)");
  parts.push(sources > 0 ? `${sources} source${sources === 1 ? "" : "s"}` : "no source on file");
  return parts.join(" · ");
}

function EpisodeCard({ row: r, sources }: { row: IndexExplanationRow; sources: number }) {
  return (
    <div className="ix-card">
      <div className="ix-card-top">
        <span className="ix-card-title">
          {r.title}
          {r.year != null ? ` (${r.year})` : ""}
        </span>
        <span className="ix-card-points">{r.points.toFixed(1)} pts</span>
      </div>
      <p className="ix-card-reason">{reasonFor(r, sources)}</p>
      <div className="ix-card-factors">
        <span>severity {r.severityBase.toFixed(2)}</span>
        <span>× recency {r.recencyFactor.toFixed(2)}</span>
        <span>× unresolved {r.ongoingFactor.toFixed(2)}</span>
      </div>
    </div>
  );
}
