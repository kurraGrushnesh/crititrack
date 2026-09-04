"use client";

import { useId } from "react";
import type { Controversy } from "@/lib/controversy";
import { indexHistory } from "@/lib/controversy-index";
import VisuallyHidden from "./VisuallyHidden";

/**
 * A compact year-by-year Score History chart. Every point is a genuine
 * recomputation of the index using only the episodes' own recorded
 * years (`indexHistory` in `lib/controversy-index.ts`) — never a stored
 * snapshot the app took at the time, which it never does. Renders
 * nothing when there is not enough dated spread to show a real shape,
 * rather than a flat or invented line.
 */
export default function IndexHistoryChart({
  controversies,
}: {
  controversies: Controversy[];
}) {
  const titleId = useId();
  const points = indexHistory(controversies);
  if (points.length < 2) return null;

  const w = 260;
  const h = 56;
  const pad = 4;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * (w - pad * 2) + pad;
      const y = h - pad - (p.score / 100) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="ix-history">
      <p className="ix-history-label">Score history</p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-labelledby={titleId}
        className="ix-history-svg"
      >
        <title id={titleId}>
          Score history from {points[0].year} to {points[points.length - 1].year},
          reconstructed from dated episodes
        </title>
        <path d={path} fill="none" className="ix-history-line" />
      </svg>
      <div className="ix-history-years">
        <span>{points[0].year}</span>
        <span>{points[points.length - 1].year}</span>
      </div>
      <VisuallyHidden as="div">
        <table>
          <caption>Score history by year, reconstructed from dated episodes</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.year}>
                <td>{p.year}</td>
                <td>{Math.round(p.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
      <p className="ix-history-note">
        Reconstructed from each episode&rsquo;s recorded year, not a
        tracked snapshot.
      </p>
    </div>
  );
}
