"use client";

import { useId } from "react";
import type { TrendPoint } from "@/lib/demo-data";
import { sentimentColorVar, sentimentLabel } from "@/lib/sentiment";
import VisuallyHidden from "./VisuallyHidden";

const DIR_LABEL = {
  up: "trending up",
  down: "trending down",
  stable: "holding steady",
} as const;

/**
 * A small sparkline of the recorded sentiment history plus the current
 * score. The line is drawn from stored dated points, the same way the
 * app's trend chart is -- it is a query over measured history, not a
 * forecast.
 *
 * Accessibility: the SVG is labelled by a `<title>`/`<desc>` pair, and
 * the dated points are also exposed as a visually-hidden table so a
 * screen-reader user gets the numbers, not just "mixed". `label` names
 * whose sentiment this is when the chart appears in a comparison, where
 * two of them sit side by side.
 */
export default function SentimentTrend({
  points,
  current,
  direction,
  label,
}: {
  points: TrendPoint[];
  current: number;
  direction: "up" | "down" | "stable";
  label?: string;
}) {
  const titleId = useId();
  const descId = useId();
  const w = 120;
  const h = 40;
  const scores = points.map((p) => p.score);
  const min = Math.min(...scores) - 4;
  const max = Math.max(...scores) + 4;
  const span = Math.max(1, max - min);
  const path = points
    .map((p, i) => {
      const x = (i / Math.max(1, points.length - 1)) * w;
      const y = h - ((p.score - min) / span) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const who = label ? `${label}: ` : "";
  const title = `${who}sentiment ${sentimentLabel(current)}, ${DIR_LABEL[direction]}`;
  const desc =
    points.length > 1
      ? `Now ${current} out of 100, ${DIR_LABEL[direction]}, over ${points.length} recorded days.`
      : `Now ${current} out of 100. Not enough history for a trend yet.`;

  return (
    <div className="trend">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
      >
        <title id={titleId}>{title}</title>
        <desc id={descId}>{desc}</desc>
        <path
          d={path}
          fill="none"
          stroke={sentimentColorVar(current)}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div>
        <div
          className="t-current"
          style={{ color: sentimentColorVar(current) }}
        >
          {current}
        </div>
        <div className="t-dir">{DIR_LABEL[direction]}</div>
      </div>
      {points.length > 1 && (
        <VisuallyHidden as="div">
          <table>
            <caption>{title} — recorded daily scores</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Score out of 100</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <td>{p.date}</td>
                  <td>{Math.round(p.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </VisuallyHidden>
      )}
    </div>
  );
}
