"use client";

import { useMemo } from "react";
import type { Controversy } from "@/lib/controversy";
import { explainControversyIndex } from "@/lib/controversy-index";

/**
 * A collapsible "why this number" panel for the Controversy Index.
 * Every row is one episode's arithmetic — severity base × recency ×
 * unresolved — and the points column sums to the score, so a reader can
 * see which episode drove it. Nothing here is a model output.
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

  if (ex.rows.length === 0) return null;

  return (
    <details className="ix-explain">
      <summary>How this score was computed</summary>
      <div className="ix-explain-body">
        <table className="ix-table">
          <thead>
            <tr>
              <th scope="col">Episode</th>
              <th scope="col">Severity</th>
              <th scope="col">Recency</th>
              <th scope="col">Unresolved</th>
              <th scope="col">Points</th>
            </tr>
          </thead>
          <tbody>
            {ex.rows.map((r, i) => (
              <tr key={i}>
                <td>
                  {r.title}
                  {r.year != null ? ` (${r.year})` : ""}
                </td>
                <td>{r.severityBase.toFixed(2)}</td>
                <td>×{r.recencyFactor.toFixed(2)}</td>
                <td>×{r.ongoingFactor.toFixed(2)}</td>
                <td>{r.points.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td colSpan={3}>weight {ex.totalWeight.toFixed(2)}</td>
              <td>{ex.score.toFixed(1)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="ix-curve">{ex.curve}</p>
      </div>
    </details>
  );
}
